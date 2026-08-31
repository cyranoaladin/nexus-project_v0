import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { isKnownCourseKey } from '@/lib/curriculum/catalog';
import { resolveStudentCourses } from '@/lib/curriculum/enrollment';
import { getCourseCapabilities } from '@/lib/aria/curriculum';
import { stableLegacyFingerprint, type LegacyClassification } from './audit-legacy-data';

interface SubscriptionRow {
  readonly id: string;
  readonly studentId: string;
  readonly userId: string;
  readonly gradeLevel: 'QUATRIEME' | 'TROISIEME' | 'SECONDE' | 'PREMIERE' | 'TERMINALE' | 'POSTBAC' | 'AUTRE';
  readonly academicTrack: 'COLLEGE' | 'EDS_GENERALE' | 'STMG' | 'STI2D' | 'ST2S' | 'STL' | 'STD2A' | 'STMG_NON_LYCEEN';
  readonly stmgPathway: 'RHC' | 'MERCATIQUE' | 'GF' | 'SIG' | 'INDETERMINE' | null;
  readonly status: 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'EXPIRED';
  readonly startDate: Date;
  readonly endDate: Date | null;
  readonly ariaSubjects: string;
}

interface EnrollmentRow {
  readonly studentId: string;
  readonly courseKey: string;
  readonly kind: 'SPECIALTY' | 'OPTION';
  readonly source: 'ADMIN' | 'ASSISTANTE' | 'BACKFILL_LEGACY_SPECIALTIES' | 'SEED';
}

export interface AriaEntitlementBackfillOptions {
  readonly runId: string;
  readonly mode: 'DRY_RUN' | 'APPLY';
  readonly sourceDigest: string;
  readonly now: Date;
}

export interface AriaEntitlementBackfillReport {
  readonly scanned: number;
  readonly deterministic: number;
  readonly archived: number;
  readonly manualReview: number;
  readonly mutated: number;
}

interface EntitlementSnapshot {
  readonly status: string;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly suspendedAt: string | null;
  readonly revokedAt: string | null;
  readonly scopes: readonly {
    readonly kind: 'GLOBAL' | 'COURSE';
    readonly courseKey: string | null;
  }[];
}

interface EntitlementStateRow {
  readonly productCode: string;
  readonly userId: string;
  readonly status: string;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly suspendedAt: string | null;
  readonly revokedAt: string | null;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

async function loadEntitlementSnapshot(
  client: PoolClient,
  entitlementId: string,
  expectedUserId?: string,
): Promise<EntitlementSnapshot | null> {
  const entitlement = await client.query<EntitlementStateRow>(
    `SELECT "productCode", "userId", status::text,
            to_char("startsAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "startsAt",
            to_char("endsAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "endsAt",
            to_char("suspendedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "suspendedAt",
            to_char("revokedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "revokedAt"
     FROM entitlements WHERE id = $1 FOR UPDATE`,
    [entitlementId],
  );
  const row = entitlement.rows[0];
  if (!row) return null;
  if (row.productCode !== 'ARIA_ACCESS' || (expectedUserId && row.userId !== expectedUserId)) {
    throw new Error('ARIA_ENTITLEMENT_BACKFILL_TARGET_OWNERSHIP_CONFLICT');
  }
  const scopes = await client.query<{ kind: 'GLOBAL' | 'COURSE'; courseKey: string | null }>(
    `SELECT kind::text, "courseKey" FROM aria_entitlement_scopes
     WHERE "entitlementId" = $1 ORDER BY kind::text, "courseKey" NULLS FIRST`,
    [entitlementId],
  );
  return {
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    suspendedAt: row.suspendedAt,
    revokedAt: row.revokedAt,
    scopes: scopes.rows,
  };
}

function parseLegacyGrantItems(value: string): readonly string[] | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) return null;
    return [...new Set(parsed)];
  } catch {
    return value.trim() ? [value.trim()] : null;
  }
}

function courseIsAriaCapable(courseKey: string): boolean {
  const capabilities = getCourseCapabilities(courseKey);
  return capabilities.hasChat || capabilities.hasSkillGraph || capabilities.hasResources;
}

function resolveScopes(
  subscription: SubscriptionRow,
  enrollments: readonly EnrollmentRow[],
): {
  readonly classification: LegacyClassification;
  readonly scopes: readonly ({ kind: 'GLOBAL'; courseKey: null } | { kind: 'COURSE'; courseKey: string })[];
} {
  const items = parseLegacyGrantItems(subscription.ariaSubjects);
  if (!items || items.length === 0) {
    return { classification: 'ARCHIVED_NON_RESUMABLE', scopes: [] };
  }
  const followed = resolveStudentCourses(
    {
      gradeLevel: subscription.gradeLevel,
      academicTrack: subscription.academicTrack,
      stmgPathway: subscription.stmgPathway,
    },
    enrollments,
  ).filter(({ academicStatus }) => academicStatus !== 'NOT_ENROLLED');
  const scopes = new Map<string, { kind: 'GLOBAL'; courseKey: null } | { kind: 'COURSE'; courseKey: string }>();

  for (const raw of items) {
    const item = raw.trim();
    if (item === 'ALL' || item === 'aria_global') {
      scopes.set('GLOBAL', { kind: 'GLOBAL', courseKey: null });
      continue;
    }
    if (isKnownCourseKey(item)) {
      if (!followed.some(({ course }) => course.courseKey === item) || !courseIsAriaCapable(item)) {
        return { classification: 'MANUAL_REVIEW_REQUIRED', scopes: [] };
      }
      scopes.set(`COURSE:${item}`, { kind: 'COURSE', courseKey: item });
      continue;
    }

    const subject = item === 'aria_maths' ? 'MATHEMATIQUES'
      : item === 'aria_nsi' ? 'NSI'
        : item;
    const candidates = followed.filter(({ course }) => {
      if (subject === 'STMG' || subject === 'aria_stmg') {
        return course.courseKey.startsWith('stmg-') && courseIsAriaCapable(course.courseKey);
      }
      return course.legacySubject === subject && courseIsAriaCapable(course.courseKey);
    });
    if (candidates.length !== 1) {
      return { classification: 'MANUAL_REVIEW_REQUIRED', scopes: [] };
    }
    const courseKey = candidates[0].course.courseKey;
    scopes.set(`COURSE:${courseKey}`, { kind: 'COURSE', courseKey });
  }
  if (scopes.has('GLOBAL')) {
    return { classification: 'DETERMINISTIC_BACKFILL', scopes: [{ kind: 'GLOBAL', courseKey: null }] };
  }
  return {
    classification: scopes.size > 0 ? 'DETERMINISTIC_BACKFILL' : 'ARCHIVED_NON_RESUMABLE',
    scopes: [...scopes.values()].sort((left, right) =>
      (left.courseKey ?? '').localeCompare(right.courseKey ?? '')),
  };
}

function entitlementStatus(status: SubscriptionRow['status']): 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED' {
  if (status === 'ACTIVE') return 'ACTIVE';
  if (status === 'INACTIVE') return 'SUSPENDED';
  if (status === 'CANCELLED') return 'REVOKED';
  return 'EXPIRED';
}

async function executeBackfill(
  client: PoolClient,
  options: AriaEntitlementBackfillOptions,
): Promise<AriaEntitlementBackfillReport> {
  const subscriptions = await client.query<SubscriptionRow>(
    `SELECT sub.id, sub."studentId", student."userId", student."gradeLevel"::text,
            student."academicTrack"::text, student."stmgPathway"::text,
            sub.status::text, sub."startDate", sub."endDate", sub."ariaSubjects"
     FROM subscriptions sub JOIN students student ON student.id = sub."studentId"
     ORDER BY sub.id FOR UPDATE OF sub`,
  );
  const enrollmentRows = await client.query<EnrollmentRow>(
    `SELECT "studentId", "courseKey", kind::text, source::text
     FROM student_academic_enrollments ORDER BY "studentId", "courseKey"`,
  );
  const enrollmentsByStudent = new Map<string, EnrollmentRow[]>();
  for (const enrollment of enrollmentRows.rows) {
    const entries = enrollmentsByStudent.get(enrollment.studentId) ?? [];
    entries.push(enrollment);
    enrollmentsByStudent.set(enrollment.studentId, entries);
  }
  const decisions = subscriptions.rows.map((subscription) => ({
    subscription,
    decision: resolveScopes(subscription, enrollmentsByStudent.get(subscription.studentId) ?? []),
  }));
  const deterministic = decisions.filter(({ decision }) => decision.classification === 'DETERMINISTIC_BACKFILL').length;
  const archived = decisions.filter(({ decision }) => decision.classification === 'ARCHIVED_NON_RESUMABLE').length;
  const manualReview = decisions.filter(({ decision }) => decision.classification === 'MANUAL_REVIEW_REQUIRED').length;
  if (options.mode === 'DRY_RUN') {
    return { scanned: decisions.length, deterministic, archived, manualReview, mutated: 0 };
  }

  const run = await client.query<{ id: string }>(
    `INSERT INTO aria_data_migration_runs
      (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status)
     VALUES ($1, 'aria-entitlements-v1', 'APPLY', $2::jsonb, $3, 'RUNNING')
     ON CONFLICT ("migrationName", "sourceDigest", mode)
     DO UPDATE SET "sourceDigest" = EXCLUDED."sourceDigest"
     RETURNING id`,
    [
      options.runId,
      JSON.stringify({ sourceTypes: ['subscription', 'academic-map', 'capability'], version: 1 }),
      options.sourceDigest,
    ],
  );
  const runId = run.rows[0].id;
  let mutated = 0;
  for (const { subscription, decision } of decisions) {
    const beforeImage = {
      ariaSubjects: subscription.ariaSubjects,
      endDate: subscription.endDate?.toISOString() ?? null,
      startDate: subscription.startDate.toISOString(),
      status: subscription.status,
      subscriptionId: subscription.id,
    };
    let targetId: string | null = null;
    if (decision.classification === 'DETERMINISTIC_BACKFILL') {
      const status = entitlementStatus(subscription.status);
      const existing = await client.query<{ id: string }>(
        'SELECT id FROM entitlements WHERE "sourceSubscriptionId" = $1 FOR UPDATE',
        [subscription.id],
      );
      const existingId = existing.rows[0]?.id ?? null;
      const entitlementBefore = existingId
        ? await loadEntitlementSnapshot(client, existingId, subscription.userId)
        : null;
      const entitlement = await client.query<{ id: string }>(
        `INSERT INTO entitlements
          (id, "userId", "productCode", label, status, "startsAt", "endsAt",
           "sourceSubscriptionId", "suspendedAt", "revokedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, 'ARIA_ACCESS', 'Accès ARIA', $3::"EntitlementStatus", $4, $5, $6,
                 $7, $8, NOW(), NOW())
         ON CONFLICT ("sourceSubscriptionId") DO UPDATE SET
           status = EXCLUDED.status, "startsAt" = EXCLUDED."startsAt",
           "endsAt" = EXCLUDED."endsAt", "suspendedAt" = EXCLUDED."suspendedAt",
           "revokedAt" = EXCLUDED."revokedAt", "updatedAt" = NOW()
         RETURNING id`,
        [
          randomUUID(),
          subscription.userId,
          status,
          subscription.startDate,
          subscription.endDate,
          subscription.id,
          status === 'SUSPENDED' ? options.now : null,
          status === 'REVOKED' ? options.now : null,
        ],
      );
      targetId = entitlement.rows[0].id;
      await client.query('DELETE FROM aria_entitlement_scopes WHERE "entitlementId" = $1', [targetId]);
      for (const scope of decision.scopes) {
        await client.query(
          `INSERT INTO aria_entitlement_scopes
            (id, "entitlementId", kind, "courseKey", "createdAt", "updatedAt")
           VALUES ($1, $2, $3::"AriaEntitlementScopeKind", $4, NOW(), NOW())`,
          [randomUUID(), targetId, scope.kind, scope.courseKey],
        );
      }
      const entitlementAfter = await loadEntitlementSnapshot(client, targetId, subscription.userId);
      if (!entitlementAfter) throw new Error('ARIA_ENTITLEMENT_BACKFILL_TARGET_MISSING');
      const targetKey = {
        afterFingerprint: stableLegacyFingerprint(entitlementAfter),
        created: existingId === null,
        scopeCount: decision.scopes.length,
      };
      mutated += 1;
      await client.query(
        `INSERT INTO aria_data_migration_row_audits
          (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
           "targetTable", "targetId", "targetKey", "beforeImage")
         VALUES ($1, $2, 'ARIA_SUBSCRIPTION_ENTITLEMENT', $3, $4, $5,
                 'entitlements', $6, $7::jsonb, $8::jsonb)
         ON CONFLICT ("runId", "sourceType", "sourceId") DO NOTHING`,
        [
          randomUUID(), runId, subscription.id,
          stableLegacyFingerprint(beforeImage), decision.classification,
          targetId, JSON.stringify(targetKey),
          JSON.stringify({ ...beforeImage, entitlement: entitlementBefore }),
        ],
      );
      continue;
    }
    await client.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
         "targetTable", "targetId", "targetKey", "beforeImage")
       VALUES ($1, $2, 'ARIA_SUBSCRIPTION_ENTITLEMENT', $3, $4, $5,
               $6, $7, $8::jsonb, $9::jsonb)
       ON CONFLICT ("runId", "sourceType", "sourceId") DO NOTHING`,
      [
        randomUUID(),
        runId,
        subscription.id,
        stableLegacyFingerprint(beforeImage),
        decision.classification,
        targetId ? 'entitlements' : null,
        targetId,
        null,
        JSON.stringify({ ...beforeImage, entitlement: null }),
      ],
    );
  }
  await client.query(
    `UPDATE aria_data_migration_runs SET status = 'COMPLETED',
       "scannedCount" = $2, "deterministicCount" = $3, "archivedCount" = $4,
       "manualReviewCount" = $5, "mutatedCount" = $6, "completedAt" = NOW()
     WHERE id = $1`,
    [runId, decisions.length, deterministic, archived, manualReview, mutated],
  );
  return { scanned: decisions.length, deterministic, archived, manualReview, mutated };
}

export async function backfillAriaEntitlements(
  pool: Pool,
  options: AriaEntitlementBackfillOptions,
): Promise<AriaEntitlementBackfillReport> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const report = await executeBackfill(client, options);
    if (options.mode === 'APPLY') await client.query('COMMIT');
    else await client.query('ROLLBACK');
    return report;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

interface EntitlementRollbackAudit {
  readonly sourceId: string;
  readonly sourceFingerprint: string;
  readonly targetId: string;
  readonly targetKey: {
    readonly afterFingerprint: string;
    readonly created: boolean;
  };
  readonly beforeImage: {
    readonly ariaSubjects: string;
    readonly endDate: string | null;
    readonly entitlement: EntitlementSnapshot | null;
    readonly startDate: string;
    readonly status: SubscriptionRow['status'];
    readonly subscriptionId: string;
  };
}

export async function rollbackAriaEntitlementBackfill(
  pool: Pool,
  runId: string,
): Promise<{
  readonly entitlementsDeleted: number;
  readonly entitlementsRestored: number;
}> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const run = await client.query<{ status: string }>(
      'SELECT status::text FROM aria_data_migration_runs WHERE id = $1 FOR UPDATE',
      [runId],
    );
    if (run.rowCount !== 1 || run.rows[0].status !== 'COMPLETED') {
      throw new Error('ARIA_ENTITLEMENT_ROLLBACK_RUN_NOT_COMPLETED');
    }
    const audits = await client.query<EntitlementRollbackAudit>(
      `SELECT "sourceId", "sourceFingerprint", "targetId", "targetKey", "beforeImage"
       FROM aria_data_migration_row_audits
       WHERE "runId" = $1 AND "sourceType" = 'ARIA_SUBSCRIPTION_ENTITLEMENT'
         AND classification = 'DETERMINISTIC_BACKFILL' AND "targetId" IS NOT NULL
       ORDER BY "sourceId" FOR UPDATE`,
      [runId],
    );
    let entitlementsDeleted = 0;
    let entitlementsRestored = 0;
    for (const audit of audits.rows) {
      const source = await client.query<SubscriptionRow>(
        `SELECT sub.id, sub."studentId", student."userId", student."gradeLevel"::text,
                student."academicTrack"::text, student."stmgPathway"::text,
                sub.status::text, sub."startDate", sub."endDate", sub."ariaSubjects"
         FROM subscriptions sub JOIN students student ON student.id = sub."studentId"
         WHERE sub.id = $1 FOR UPDATE OF sub`,
        [audit.sourceId],
      );
      const subscription = source.rows[0];
      const currentSourceFingerprint = subscription && stableLegacyFingerprint({
        ariaSubjects: subscription.ariaSubjects,
        endDate: iso(subscription.endDate),
        startDate: subscription.startDate.toISOString(),
        status: subscription.status,
        subscriptionId: subscription.id,
      });
      if (!subscription || currentSourceFingerprint !== audit.sourceFingerprint) {
        throw new Error('ARIA_ENTITLEMENT_ROLLBACK_SOURCE_CONFLICT');
      }
      const current = await loadEntitlementSnapshot(client, audit.targetId, subscription.userId);
      if (
        !current
        || stableLegacyFingerprint(current) !== audit.targetKey.afterFingerprint
      ) {
        throw new Error('ARIA_ENTITLEMENT_ROLLBACK_TARGET_CONFLICT');
      }
      if (audit.targetKey.created) {
        const deletion = await client.query(
          'DELETE FROM entitlements WHERE id = $1 AND "sourceSubscriptionId" = $2',
          [audit.targetId, audit.sourceId],
        );
        if (deletion.rowCount !== 1) throw new Error('ARIA_ENTITLEMENT_ROLLBACK_TARGET_CONFLICT');
        entitlementsDeleted += 1;
        continue;
      }
      const before = audit.beforeImage.entitlement;
      if (!before) throw new Error('ARIA_ENTITLEMENT_ROLLBACK_BEFORE_IMAGE_MISSING');
      const restoration = await client.query(
        `UPDATE entitlements SET status = $2::"EntitlementStatus", "startsAt" = $3,
           "endsAt" = $4, "suspendedAt" = $5, "revokedAt" = $6, "updatedAt" = NOW()
         WHERE id = $1 AND "sourceSubscriptionId" = $7`,
        [
          audit.targetId, before.status, before.startsAt, before.endsAt,
          before.suspendedAt, before.revokedAt, audit.sourceId,
        ],
      );
      if (restoration.rowCount !== 1) throw new Error('ARIA_ENTITLEMENT_ROLLBACK_TARGET_CONFLICT');
      await client.query('DELETE FROM aria_entitlement_scopes WHERE "entitlementId" = $1', [audit.targetId]);
      for (const scope of before.scopes) {
        await client.query(
          `INSERT INTO aria_entitlement_scopes
            (id, "entitlementId", kind, "courseKey", "createdAt", "updatedAt")
           VALUES ($1, $2, $3::"AriaEntitlementScopeKind", $4, NOW(), NOW())`,
          [randomUUID(), audit.targetId, scope.kind, scope.courseKey],
        );
      }
      entitlementsRestored += 1;
    }
    const completion = await client.query(
      `UPDATE aria_data_migration_runs SET status = 'ROLLED_BACK', "completedAt" = NOW()
       WHERE id = $1 AND status = 'COMPLETED'`,
      [runId],
    );
    if (completion.rowCount !== 1) throw new Error('ARIA_ENTITLEMENT_ROLLBACK_RUN_NOT_COMPLETED');
    await client.query('COMMIT');
    return { entitlementsDeleted, entitlementsRestored };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
