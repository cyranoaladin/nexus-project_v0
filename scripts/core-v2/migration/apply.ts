/**
 * Applies a TargetPlan to the Core v2 database — the only side effect of the
 * migrator. Identity/enrollment/assignment rows go in ONE transaction (all or
 * nothing); each planning series is then created in its own transaction so a
 * slot conflict rejects that series alone (reported) and never the roster.
 * Every write is an upsert on a deterministic id; the existing row's
 * canonical payload is hashed with the same function as the plan, so a rerun
 * reports UNCHANGED / UPDATED truthfully. Dry run computes the same report
 * without writing anything.
 */
import type { PrismaClient } from '@/core-v2/generated/client';
import { appendAuditEvent } from '@/lib/core-v2/audit';
import { isCoreV2DomainError } from '@/lib/core-v2/errors';
import { createServiceContext, type Tx } from '@/lib/core-v2/services/context';
import { loadPlanningParticipants, materializeSeriesOccurrences } from '@/lib/core-v2/services/planning';
import { localDateFromDateColumn, compareLocalDates, zonedParts } from '@/lib/core-v2/time';
import type { TargetPlan } from './transform';
import { objectHash } from './transform';
import { MIGRATION_ENTITIES, OBJECT_RESULTS, type MigrationEntity, type MigrationManifest, type ObjectManifestEntry, type ObjectResult, type Reconciliation } from './types';

export interface ApplyOptions {
  readonly execute: boolean;
  readonly actorUserId: string;
  readonly migratedAt: Date;
  readonly approvalDigest: string;
  readonly sourceFingerprint: string;
  readonly transformVersion: string;
  readonly correlationId: string;
}

type Outcome = { id: string; result: ObjectResult; reason?: string };

function decide(existingHash: string | null, plannedHash: string, execute: boolean): ObjectResult {
  if (existingHash === plannedHash) return 'UNCHANGED';
  if (!execute) return 'PLANNED';
  return existingHash === null ? 'CREATED' : 'UPDATED';
}

/**
 * A target that already holds rows not produced by this plan is refused:
 * migrating INTO a populated Core v2 (an e2e seed, another roster) would mix
 * authorities. A rerun over the same plan is fine (every existing id is ours).
 */
async function assertTargetCompatible(client: PrismaClient, plan: TargetPlan): Promise<string> {
  const plannedUserIds = new Set(plan.users.map((u) => u.id));
  const users = await client.user.findMany({ select: { id: true } });
  const foreign = users.filter((u) => !plannedUserIds.has(u.id)).map((u) => u.id);
  if (foreign.length > 0) {
    throw new Error(`TARGET_HAS_FOREIGN_ROWS: ${foreign.length} users in the Core v2 database are not part of this plan (first: ${foreign.slice(0, 3).join(', ')}).`);
  }
  const marker = await client.coreV2DatabaseIdentity.findUnique({ where: { id: 1 } });
  return `v2:${marker?.schemaIdentity ?? '?'}#${marker?.schemaGeneration ?? '?'};users=${users.length}`;
}

export async function applyPlan(client: PrismaClient, plan: TargetPlan, options: ApplyOptions): Promise<MigrationManifest> {
  const startedAt = new Date();
  const targetFingerprint = await assertTargetCompatible(client, plan);
  const outcomes = new Map<string, Outcome>(); // `${entity}:${targetId}` → outcome
  const record = (entity: MigrationEntity, id: string, result: ObjectResult, reason?: string) => outcomes.set(`${entity}:${id}`, { id, result, reason });

  const yearStartYear = plan.academicYear.startYear;
  const academicYearId = await client.$transaction(async (tx) => {
    // Academic year: by startYear (unique in Core v2); dates from the approval file.
    const existingYear = await tx.academicYear.findUnique({ where: { startYear: yearStartYear } });
    const yearPayload = { startYear: yearStartYear, startsAt: plan.academicYear.startsAt, endsAt: plan.academicYear.endsAt };
    const yearResult = decide(existingYear ? objectHash({ startYear: existingYear.startYear, startsAt: existingYear.startsAt, endsAt: existingYear.endsAt }) : null, objectHash(yearPayload), options.execute);
    record('AcademicYear', String(yearStartYear), yearResult);
    let yearId = existingYear?.id ?? `ay-${yearStartYear}`;
    if (options.execute && yearResult !== 'UNCHANGED') {
      const year = await tx.academicYear.upsert({
        where: { startYear: yearStartYear },
        create: { id: yearId, ...yearPayload, status: 'UPCOMING' },
        update: { startsAt: yearPayload.startsAt, endsAt: yearPayload.endsAt },
      });
      yearId = year.id;
    }

    for (const u of plan.users) {
      const existing = await tx.user.findUnique({ where: { id: u.id } });
      const existingHash = existing
        ? objectHash({
            id: existing.id, email: existing.email, password: existing.password, role: existing.role, firstName: existing.firstName, lastName: existing.lastName,
            phone: existing.phone, accountStatus: existing.accountStatus, activatedAt: existing.activatedAt, sessionVersion: existing.sessionVersion,
          })
        : null;
      const result = decide(existingHash, objectHash(u), options.execute);
      record('User', u.id, result);
      if (options.execute && result !== 'UNCHANGED') {
        const { id, ...data } = u;
        // A rerun that changes identity data also revokes sessions (same contract as every other credential write).
        await tx.user.upsert({ where: { id }, create: { id, ...data }, update: { ...data, sessionVersion: existing ? { increment: 1 } : data.sessionVersion } });
      }
    }

    for (const h of plan.households) {
      const existing = await tx.household.findUnique({ where: { id: h.id } });
      const result = decide(existing ? objectHash({ id: existing.id, sourceParentProfileId: h.sourceParentProfileId }) : null, objectHash(h), options.execute);
      record('Household', h.id, result);
      if (options.execute && !existing) await tx.household.create({ data: { id: h.id } });
    }
    for (const hp of plan.householdParents) {
      const existing = await tx.householdParent.findUnique({ where: { id: hp.id } });
      const result = decide(existing ? objectHash({ id: existing.id, householdId: existing.householdId, userId: existing.userId, isPrimaryContact: existing.isPrimaryContact }) : null, objectHash(hp), options.execute);
      record('HouseholdParent', hp.id, result);
      if (options.execute && result !== 'UNCHANGED') {
        await tx.householdParent.upsert({ where: { id: hp.id }, create: hp, update: { householdId: hp.householdId, isPrimaryContact: true } });
      }
    }
    for (const s of plan.students) {
      const existing = await tx.student.findUnique({ where: { id: s.id } });
      const result = decide(existing ? objectHash({ id: existing.id, userId: existing.userId, householdId: existing.householdId, birthDate: existing.birthDate }) : null, objectHash(s), options.execute);
      record('Student', s.id, result);
      if (options.execute && result !== 'UNCHANGED') {
        await tx.student.upsert({ where: { id: s.id }, create: s, update: { householdId: s.householdId, birthDate: s.birthDate } });
      }
    }
    for (const e of plan.enrollments) {
      const existing = await tx.studentAcademicYearEnrollment.findUnique({ where: { id: e.id } });
      const existingHash = existing
        ? objectHash({ id: existing.id, studentId: existing.studentId, gradeLevel: existing.gradeLevel, academicTrack: existing.academicTrack, stmgPathway: existing.stmgPathway, schoolingStatus: existing.schoolingStatus, school: existing.school })
        : null;
      const result = decide(existingHash, objectHash(e), options.execute);
      record('StudentAcademicYearEnrollment', e.id, result);
      if (options.execute && result !== 'UNCHANGED') {
        const { id, studentId, ...academic } = e;
        await tx.studentAcademicYearEnrollment.upsert({
          where: { id },
          // Approved roster → ACTIVE, approved by the migrating actor at the declared instant.
          create: { id, studentId, academicYearId: yearId, status: 'ACTIVE', approvedAt: options.migratedAt, approvedById: options.actorUserId, ...academic } as never,
          update: { ...academic } as never,
        });
      }
    }
    for (const c of plan.courseEnrollments) {
      const existing = await tx.studentCourseEnrollment.findUnique({ where: { id: c.id } });
      const result = decide(existing ? objectHash({ id: existing.id, enrollmentId: existing.academicYearEnrollmentId, courseKey: existing.courseKey, kind: existing.kind }) : null, objectHash(c), options.execute);
      record('StudentCourseEnrollment', c.id, result);
      if (options.execute && result !== 'UNCHANGED') {
        await tx.studentCourseEnrollment.upsert({
          where: { id: c.id },
          create: { id: c.id, academicYearEnrollmentId: c.enrollmentId, courseKey: c.courseKey, kind: c.kind },
          update: { courseKey: c.courseKey, kind: c.kind },
        });
      }
    }
    for (const cp of plan.coachProfiles) {
      const existing = await tx.coachProfile.findUnique({ where: { id: cp.id } });
      const result = decide(existing ? objectHash({ id: existing.id, userId: existing.userId }) : null, objectHash(cp), options.execute);
      record('CoachProfile', cp.id, result);
      if (options.execute && !existing) await tx.coachProfile.create({ data: cp });
    }
    for (const cap of plan.capabilities) {
      const existing = await tx.coachCourseCapability.findUnique({ where: { id: cap.id } });
      const result = decide(existing ? objectHash({ id: existing.id, coachId: existing.coachId, courseKey: existing.courseKey }) : null, objectHash(cap), options.execute);
      record('CoachCourseCapability', cap.id, result);
      if (options.execute && !existing) await tx.coachCourseCapability.create({ data: cap });
    }
    for (const a of plan.assignments) {
      const existing = await tx.coachStudentCourseAssignment.findUnique({ where: { id: a.id } });
      const existingHash = existing
        ? objectHash({ id: existing.id, sourceAssignmentId: a.sourceAssignmentId, coachId: existing.coachId, enrollmentId: existing.academicYearEnrollmentId, courseKey: existing.courseKey, startsAt: existing.startsAt })
        : null;
      const result = decide(existingHash, objectHash(a), options.execute);
      record('CoachStudentCourseAssignment', a.id, result);
      if (options.execute && !existing) {
        await tx.coachStudentCourseAssignment.create({
          data: { id: a.id, coachId: a.coachId, academicYearEnrollmentId: a.enrollmentId, courseKey: a.courseKey, startsAt: a.startsAt, assignedById: options.actorUserId },
        });
      }
    }
    return yearId;
  });

  // Planning series: one transaction each, created through the engine (conflict pre-check + exclusion constraints).
  const ctx = createServiceContext({ userId: options.actorUserId, role: 'ADMIN' }, { correlationId: options.correlationId, now: () => options.migratedAt });
  for (const p of plan.planningSeries) {
    const existing = await client.planningSeries.findUnique({ where: { id: p.id } });
    const existingHash = existing
      ? objectHash({
          id: existing.id, assignmentId: existing.assignmentId, timezone: existing.timezone, startDate: existing.startDate, localStartTime: existing.localStartTime, localEndTime: existing.localEndTime,
          recurrenceRule: existing.recurrenceRule, recurrenceCount: existing.recurrenceCount, recurrenceUntil: existing.recurrenceUntil, modality: existing.modality, location: existing.location,
        })
      : null;
    const plannedHash = objectHash(p);
    if (existing) {
      // A series already migrated is never rewritten here (its occurrences may have been edited by staff since).
      record('PlanningSeries', p.id, existingHash === plannedHash ? 'UNCHANGED' : 'SKIPPED', existingHash === plannedHash ? undefined : 'ALREADY_MIGRATED_DIFFERS_NOT_REWRITTEN');
      continue;
    }
    if (!options.execute) {
      record('PlanningSeries', p.id, 'PLANNED');
      continue;
    }
    try {
      await client.$transaction(async (tx: Tx) => {
        const participants = await loadPlanningParticipants(tx, p.assignmentId);
        const series = await tx.planningSeries.create({
          data: { ...p, createdById: options.actorUserId },
        });
        // Only occurrences from the migration instant on: the past stays in Core v1 history.
        const today = zonedParts(options.migratedAt, series.timezone);
        const from = compareLocalDates(localDateFromDateColumn(series.startDate), today) > 0 ? undefined : { year: today.year, month: today.month, day: today.day };
        const count = await materializeSeriesOccurrences(tx, ctx, series, participants, from);
        if (count === 0) throw new Error('NO_FUTURE_OCCURRENCE');
      });
      record('PlanningSeries', p.id, 'CREATED');
    } catch (error) {
      const reason = isCoreV2DomainError(error) ? `${error.code}:${error.message}` : error instanceof Error ? error.message : String(error);
      record('PlanningSeries', p.id, 'REJECTED', reason.slice(0, 200));
    }
  }

  // Merge plan entries with outcomes → manifest objects.
  const objects: ObjectManifestEntry[] = plan.entries.map((e) => {
    if (e.result !== 'PLANNED' || !e.targetId) return e;
    const outcome = outcomes.get(`${e.entity}:${e.targetId}`);
    return outcome ? { ...e, result: outcome.result, reason: outcome.reason } : e;
  });
  objects.unshift({
    entity: 'AcademicYear',
    sourceId: String(yearStartYear),
    targetId: academicYearId,
    transformVersion: options.transformVersion,
    hash: objectHash(plan.academicYear),
    result: outcomes.get(`AcademicYear:${yearStartYear}`)?.result ?? 'PLANNED',
    warnings: [],
  });

  const reconciliation = await reconcile(client, plan, objects, options.execute);
  const counts = MIGRATION_ENTITIES.reduce((acc, entity) => {
    acc[entity] = OBJECT_RESULTS.reduce((inner, r) => ({ ...inner, [r]: 0 }), {} as Record<ObjectResult, number>);
    return acc;
  }, {} as Record<MigrationEntity, Record<ObjectResult, number>>);
  for (const o of objects) counts[o.entity][o.result] += 1;

  const anomalies: string[] = [];
  if (reconciliation.UNKNOWN > 0) anomalies.push(`UNKNOWN=${reconciliation.UNKNOWN}`);
  if (reconciliation.SILENT_DROPPED > 0) anomalies.push(`SILENT_DROPPED=${reconciliation.SILENT_DROPPED}`);
  if (reconciliation.DUPLICATE_TARGET > 0) anomalies.push(`DUPLICATE_TARGET=${reconciliation.DUPLICATE_TARGET}`);
  if (reconciliation.UNMAPPED_APPROVED > 0) anomalies.push(`UNMAPPED_APPROVED=${reconciliation.UNMAPPED_APPROVED}`);

  const manifest: MigrationManifest = {
    transformVersion: options.transformVersion,
    mode: options.execute ? 'EXECUTE' : 'DRY_RUN',
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    migratedAt: options.migratedAt.toISOString(),
    approvalDigest: options.approvalDigest,
    approvedStudentCount: plan.students.length + plan.entries.filter((e) => e.entity === 'Student' && e.result !== 'PLANNED').length,
    sourceFingerprint: options.sourceFingerprint,
    targetFingerprint,
    counts,
    objects,
    reconciliation,
    anomalies,
  };

  if (options.execute) {
    await client.$transaction((tx) =>
      appendAuditEvent(tx, {
        actorUserId: options.actorUserId,
        action: 'migration.run_completed',
        subjectType: 'MigrationRun',
        subjectId: objectHash({ approvalDigest: options.approvalDigest, sourceFingerprint: options.sourceFingerprint, migratedAt: options.migratedAt }).slice(0, 32),
        correlationId: options.correlationId,
        metadata: {
          approvalDigest: options.approvalDigest,
          sourceFingerprint: options.sourceFingerprint,
          manifestHash: objectHash(objects),
          anomalies,
          created: objects.filter((o) => o.result === 'CREATED').length,
          updated: objects.filter((o) => o.result === 'UPDATED').length,
          unchanged: objects.filter((o) => o.result === 'UNCHANGED').length,
          rejected: objects.filter((o) => o.result === 'REJECTED').length,
          skipped: objects.filter((o) => o.result === 'SKIPPED').length,
        },
      }),
    );
  }
  return manifest;
}

/**
 * Reads the target back and compares with the plan:
 *   UNKNOWN          — manifest rows outside the closed result set (0 by construction),
 *   SILENT_DROPPED   — planned objects with no outcome at all,
 *   DUPLICATE_TARGET — two Core v2 users sharing a case-insensitive e-mail, or two ACTIVE enrollments for one student/year,
 *   UNMAPPED_APPROVED— approved students without an ACTIVE enrollment in the target (EXECUTE) / without a planned one (DRY_RUN).
 */
async function reconcile(client: PrismaClient, plan: TargetPlan, objects: readonly ObjectManifestEntry[], execute: boolean): Promise<Reconciliation> {
  const UNKNOWN = objects.filter((o) => !OBJECT_RESULTS.includes(o.result)).length;
  const SILENT_DROPPED = objects.filter((o) => o.result === 'PLANNED' && execute).length;

  const emails = await client.user.findMany({ where: { email: { not: null } }, select: { email: true } });
  const seen = new Map<string, number>();
  for (const { email } of emails) seen.set(email!.toLowerCase(), (seen.get(email!.toLowerCase()) ?? 0) + 1);
  let DUPLICATE_TARGET = [...seen.values()].filter((n) => n > 1).length;
  const activePerStudent = await client.studentAcademicYearEnrollment.groupBy({ by: ['studentId', 'academicYearId'], where: { status: 'ACTIVE' }, _count: { _all: true } });
  DUPLICATE_TARGET += activePerStudent.filter((g) => g._count._all > 1).length;

  let UNMAPPED_APPROVED = 0;
  if (execute) {
    const year = await client.academicYear.findUnique({ where: { startYear: plan.academicYear.startYear } });
    const active = year ? await client.studentAcademicYearEnrollment.findMany({ where: { academicYearId: year.id, status: 'ACTIVE' }, select: { studentId: true } }) : [];
    const covered = new Set(active.map((a) => a.studentId));
    UNMAPPED_APPROVED = plan.students.filter((s) => !covered.has(s.id)).length;
  } else {
    const planned = new Set(plan.enrollments.map((e) => e.studentId));
    UNMAPPED_APPROVED = plan.students.filter((s) => !planned.has(s.id)).length;
  }
  return { UNKNOWN, SILENT_DROPPED, DUPLICATE_TARGET, UNMAPPED_APPROVED };
}
