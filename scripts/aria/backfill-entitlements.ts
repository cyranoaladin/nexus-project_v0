import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { isKnownCourseKey } from '@/lib/curriculum/catalog';
import { resolveStudentCourses } from '@/lib/curriculum/enrollment';
import { getCourseCapabilities } from '@/lib/aria/curriculum';
import { stableLegacyFingerprint, type LegacyClassification } from './audit-legacy-data';
import {
  canonicalizeAriaBackfillJson,
  createAriaBackfillSnapshot,
  type AriaBackfillSourceSnapshot,
} from './backfill-snapshot';

export interface AriaEntitlementSubscriptionInput {
  readonly id: string;
  readonly studentId: string;
  readonly userId: string;
  readonly gradeLevel: 'QUATRIEME' | 'TROISIEME' | 'SECONDE' | 'PREMIERE' | 'TERMINALE' | 'POSTBAC' | 'AUTRE';
  readonly academicTrack: 'COLLEGE' | 'EDS_GENERALE' | 'STMG' | 'STI2D' | 'ST2S' | 'STL' | 'STD2A' | 'STMG_NON_LYCEEN';
  readonly stmgPathway: 'RHC' | 'MERCATIQUE' | 'GF' | 'SIG' | 'INDETERMINE' | null;
  readonly status: 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'EXPIRED';
  readonly startDate: Date | string;
  readonly endDate: Date | string | null;
  readonly ariaSubjects: string;
}

export interface AriaEntitlementEnrollmentInput {
  readonly studentId: string;
  readonly courseKey: string;
  readonly kind: 'SPECIALTY' | 'OPTION';
  readonly source: 'ADMIN' | 'ASSISTANTE' | 'BACKFILL_LEGACY_SPECIALTIES' | 'SEED';
}

interface PlannedAriaEntitlementSubscription extends Omit<
  AriaEntitlementSubscriptionInput, 'startDate' | 'endDate'
> {
  readonly startDate: string;
  readonly endDate: string | null;
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
  readonly sourceDigest: string;
  readonly sourceSnapshot: AriaBackfillSourceSnapshot;
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

export interface ExistingAriaEntitlementInput extends EntitlementSnapshot {
  readonly id: string;
  readonly productCode: string;
  readonly userId: string;
}

export interface AriaEntitlementBackfillPlan {
  readonly decisions: readonly Readonly<{
    subscription: PlannedAriaEntitlementSubscription;
    enrollments: readonly AriaEntitlementEnrollmentInput[];
    classification: LegacyClassification;
    desired: Readonly<EntitlementSnapshot> | null;
    existing: Readonly<ExistingAriaEntitlementInput> | null;
    generation: number;
  }>[];
  readonly report: AriaEntitlementBackfillReport;
  readonly sourceDigest: string;
  readonly sourceSnapshot: AriaBackfillSourceSnapshot;
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

interface AriaEntitlementSubscriptionDbRow extends Omit<
  AriaEntitlementSubscriptionInput,
  'startDate' | 'endDate'
> {
  readonly startDate: Date;
  readonly endDate: Date | null;
}

interface ExistingEntitlementDbRow extends EntitlementStateRow {
  readonly id: string;
  readonly sourceSubscriptionId: string;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function normalizedInstant(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('ARIA_ENTITLEMENT_BACKFILL_DATE_INVALID');
  return date.toISOString();
}

function databaseInstant(value: string | null): Date | null {
  if (value === null) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('ARIA_ENTITLEMENT_BACKFILL_DATE_INVALID');
  return date;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function persistedPlannerSnapshot(value: unknown): AriaBackfillSourceSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('ARIA_ENTITLEMENT_BACKFILL_REPLAY_SEAL_INVALID');
  }
  const record = value as Record<string, unknown>;
  const sha256Pattern = /^[a-f0-9]{64}$/;
  const inputDigests = record.inputDigests as Record<string, unknown> | undefined;
  const report = record.report as Record<string, unknown> | undefined;
  const keys = Object.keys(record).sort().join(',');
  if (
    keys !== 'inputDigests,plannerVersion,report,schemaVersion,sourceSnapshotSha256,target,unitsSha256'
    || record.schemaVersion !== 1
    || record.target !== 'entitlements'
    || !Number.isInteger(record.plannerVersion)
    || (record.plannerVersion as number) < 1
    || typeof record.unitsSha256 !== 'string'
    || !sha256Pattern.test(record.unitsSha256)
    || typeof record.sourceSnapshotSha256 !== 'string'
    || !sha256Pattern.test(record.sourceSnapshotSha256)
    || !inputDigests
    || typeof inputDigests !== 'object'
    || Array.isArray(inputDigests)
    || Object.values(inputDigests).some(
      (digest) => typeof digest !== 'string' || !sha256Pattern.test(digest),
    )
    || !report
    || typeof report !== 'object'
    || Array.isArray(report)
    || Object.keys(report).sort().join(',') !== 'archived,deterministic,manualReview,scanned'
    || Object.values(report).some((count) => !Number.isInteger(count) || (count as number) < 0)
  ) {
    throw new Error('ARIA_ENTITLEMENT_BACKFILL_REPLAY_SEAL_INVALID');
  }
  const descriptor: Omit<AriaBackfillSourceSnapshot, 'sourceSnapshotSha256'> = {
    schemaVersion: 1,
    target: 'entitlements',
    plannerVersion: record.plannerVersion as number,
    inputDigests: Object.fromEntries(
      Object.entries(inputDigests).map(([name, digest]) => [name, digest as string]),
    ),
    unitsSha256: record.unitsSha256,
    report: {
      scanned: report.scanned as number,
      deterministic: report.deterministic as number,
      archived: report.archived as number,
      manualReview: report.manualReview as number,
    },
  };
  const expectedDigest = createHash('sha256')
    .update(canonicalizeAriaBackfillJson(descriptor))
    .digest('hex');
  if (expectedDigest !== record.sourceSnapshotSha256) {
    throw new Error('ARIA_ENTITLEMENT_BACKFILL_REPLAY_SEAL_INVALID');
  }
  return Object.freeze({
    ...descriptor,
    sourceSnapshotSha256: record.sourceSnapshotSha256,
  });
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
     WHERE "entitlementId" = $1 ORDER BY kind::text, "courseKey" NULLS FIRST
     FOR UPDATE`,
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

async function loadPlannerTargetState(
  client: PoolClient,
  subscriptionIds: readonly string[],
): Promise<ReadonlyMap<string, ExistingAriaEntitlementInput>> {
  if (subscriptionIds.length === 0) return new Map();
  const entitlements = await client.query<ExistingEntitlementDbRow>(
    `SELECT id, "sourceSubscriptionId", "productCode", "userId", status::text,
            to_char("startsAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "startsAt",
            to_char("endsAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "endsAt",
            to_char("suspendedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "suspendedAt",
            to_char("revokedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "revokedAt"
     FROM entitlements
     WHERE "sourceSubscriptionId" = ANY($1::text[])
     ORDER BY "sourceSubscriptionId" FOR UPDATE`,
    [subscriptionIds],
  );
  const entitlementIds = entitlements.rows.map(({ id }) => id);
  const scopeRows = entitlementIds.length === 0
    ? { rows: [] as Array<{
      entitlementId: string;
      kind: 'GLOBAL' | 'COURSE';
      courseKey: string | null;
    }> }
    : await client.query<{
      entitlementId: string;
      kind: 'GLOBAL' | 'COURSE';
      courseKey: string | null;
    }>(
      `SELECT "entitlementId", kind::text, "courseKey"
       FROM aria_entitlement_scopes
       WHERE "entitlementId" = ANY($1::text[])
       ORDER BY "entitlementId", kind::text, "courseKey" NULLS FIRST
       FOR UPDATE`,
      [entitlementIds],
    );
  const scopesByEntitlement = new Map<string, Array<{
    kind: 'GLOBAL' | 'COURSE';
    courseKey: string | null;
  }>>();
  for (const scope of scopeRows.rows) {
    const scopes = scopesByEntitlement.get(scope.entitlementId) ?? [];
    scopes.push({ kind: scope.kind, courseKey: scope.courseKey });
    scopesByEntitlement.set(scope.entitlementId, scopes);
  }
  return new Map(entitlements.rows.map((row) => [row.sourceSubscriptionId, {
    id: row.id,
    productCode: row.productCode,
    userId: row.userId,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    suspendedAt: row.suspendedAt,
    revokedAt: row.revokedAt,
    scopes: scopesByEntitlement.get(row.id) ?? [],
  }]));
}

async function loadPlannerLineage(
  client: PoolClient,
  subscriptionIds: readonly string[],
): Promise<ReadonlyMap<string, number>> {
  if (subscriptionIds.length === 0) return new Map();
  await client.query(
    `SELECT audit.id
     FROM aria_data_migration_row_audits audit
     JOIN aria_data_migration_runs migration_run ON migration_run.id = audit."runId"
     WHERE migration_run."migrationName" = 'aria-entitlements-v1'
       AND audit."sourceType" = 'ARIA_SUBSCRIPTION_ENTITLEMENT'
       AND audit."sourceId" = ANY($1::text[])
     ORDER BY audit.id FOR UPDATE OF audit, migration_run`,
    [subscriptionIds],
  );
  const lineage = await client.query<{ sourceId: string; generation: number }>(
    `SELECT audit."sourceId",
            COALESCE(MAX(
              CASE WHEN audit."targetKey"->>'generation' ~ '^[1-9][0-9]*$'
                THEN (audit."targetKey"->>'generation')::integer ELSE 1 END
            ), 0)::integer AS generation
     FROM aria_data_migration_row_audits audit
     JOIN aria_data_migration_runs migration_run ON migration_run.id = audit."runId"
     WHERE migration_run."migrationName" = 'aria-entitlements-v1'
       AND audit."sourceType" = 'ARIA_SUBSCRIPTION_ENTITLEMENT'
       AND audit."sourceId" = ANY($1::text[])
     GROUP BY audit."sourceId" ORDER BY audit."sourceId"`,
    [subscriptionIds],
  );
  return new Map(lineage.rows.map(({ sourceId, generation }) => [sourceId, generation]));
}

function parseLegacyGrantItems(value: string):
  | { readonly status: 'EMPTY' }
  | { readonly status: 'MALFORMED' }
  | { readonly status: 'ITEMS'; readonly items: readonly string[] } {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      return { status: 'MALFORMED' };
    }
    const items = [...new Set(parsed)];
    return items.length === 0 ? { status: 'EMPTY' } : { status: 'ITEMS', items };
  } catch {
    const item = value.trim();
    return item ? { status: 'ITEMS', items: [item] } : { status: 'EMPTY' };
  }
}

function courseIsAriaCapable(courseKey: string): boolean {
  const capabilities = getCourseCapabilities(courseKey);
  return capabilities.hasChat || capabilities.hasSkillGraph
    || capabilities.hasResources || capabilities.hasRagCorpus;
}

function resolveScopes(
  subscription: Pick<
  AriaEntitlementSubscriptionInput,
  'ariaSubjects' | 'gradeLevel' | 'academicTrack' | 'stmgPathway'
  >,
  enrollments: readonly AriaEntitlementEnrollmentInput[],
): {
  readonly classification: LegacyClassification;
  readonly scopes: readonly ({ kind: 'GLOBAL'; courseKey: null } | { kind: 'COURSE'; courseKey: string })[];
  readonly academicMapConsulted: boolean;
} {
  const parsedGrant = parseLegacyGrantItems(subscription.ariaSubjects);
  if (parsedGrant.status === 'MALFORMED') {
    return { classification: 'MANUAL_REVIEW_REQUIRED', scopes: [], academicMapConsulted: false };
  }
  if (parsedGrant.status === 'EMPTY') {
    return { classification: 'ARCHIVED_NON_RESUMABLE', scopes: [], academicMapConsulted: false };
  }
  const { items } = parsedGrant;
  let followed: ReturnType<typeof resolveStudentCourses> | null = null;
  const followedCourses = () => {
    followed ??= resolveStudentCourses(
      {
        gradeLevel: subscription.gradeLevel,
        academicTrack: subscription.academicTrack,
        stmgPathway: subscription.stmgPathway,
      },
      enrollments,
    ).filter(({ academicStatus }) => academicStatus !== 'NOT_ENROLLED');
    return followed;
  };
  const scopes = new Map<string, { kind: 'GLOBAL'; courseKey: null } | { kind: 'COURSE'; courseKey: string }>();

  for (const raw of items) {
    const item = raw.trim();
    if (item === 'ALL' || item === 'aria_global') {
      scopes.set('GLOBAL', { kind: 'GLOBAL', courseKey: null });
      continue;
    }
    if (isKnownCourseKey(item)) {
      if (!followedCourses().some(({ course }) => course.courseKey === item)) {
        return { classification: 'MANUAL_REVIEW_REQUIRED', scopes: [], academicMapConsulted: true };
      }
      scopes.set(`COURSE:${item}`, { kind: 'COURSE', courseKey: item });
      continue;
    }

    const subject = item === 'aria_maths' ? 'MATHEMATIQUES'
      : item === 'aria_nsi' ? 'NSI'
        : item;
    const candidates = followedCourses().filter(({ course }) => {
      if (subject === 'STMG' || subject === 'aria_stmg') {
        return course.courseKey.startsWith('stmg-') && courseIsAriaCapable(course.courseKey);
      }
      return course.legacySubject === subject && courseIsAriaCapable(course.courseKey);
    });
    if (candidates.length !== 1) {
      return { classification: 'MANUAL_REVIEW_REQUIRED', scopes: [], academicMapConsulted: true };
    }
    const courseKey = candidates[0].course.courseKey;
    scopes.set(`COURSE:${courseKey}`, { kind: 'COURSE', courseKey });
  }
  if (scopes.has('GLOBAL')) {
    return {
      classification: 'DETERMINISTIC_BACKFILL',
      scopes: [{ kind: 'GLOBAL', courseKey: null }],
      academicMapConsulted: followed !== null,
    };
  }
  return {
    classification: scopes.size > 0 ? 'DETERMINISTIC_BACKFILL' : 'ARCHIVED_NON_RESUMABLE',
    scopes: [...scopes.values()].sort((left, right) =>
      compareText(left.courseKey ?? '', right.courseKey ?? '')),
    academicMapConsulted: followed !== null,
  };
}

function entitlementStatus(status: AriaEntitlementSubscriptionInput['status']): 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED' {
  if (status === 'ACTIVE') return 'ACTIVE';
  if (status === 'INACTIVE') return 'SUSPENDED';
  if (status === 'CANCELLED') return 'REVOKED';
  return 'EXPIRED';
}

function freezeScopes(scopes: EntitlementSnapshot['scopes']): EntitlementSnapshot['scopes'] {
  return Object.freeze(scopes.map((scope) => Object.freeze({ ...scope })));
}

export function planAriaEntitlementBackfill(input: Readonly<{
  subscriptions: readonly AriaEntitlementSubscriptionInput[];
  enrollments: readonly AriaEntitlementEnrollmentInput[];
  existingEntitlements: ReadonlyMap<string, ExistingAriaEntitlementInput>;
  priorGenerations: ReadonlyMap<string, number>;
  now: Date | string;
}>): AriaEntitlementBackfillPlan {
  const now = normalizedInstant(input.now) as string;
  const subscriptions = input.subscriptions.map((subscription) => Object.freeze({
    ...subscription,
    startDate: normalizedInstant(subscription.startDate) as string,
    endDate: normalizedInstant(subscription.endDate),
  })).sort((left, right) => compareText(left.id, right.id));
  const enrollments = input.enrollments.map((enrollment) => Object.freeze({ ...enrollment }))
    .sort((left, right) => compareText(left.studentId, right.studentId)
      || compareText(left.courseKey, right.courseKey)
      || compareText(left.kind, right.kind)
      || compareText(left.source, right.source));
  const enrollmentsByStudent = new Map<string, AriaEntitlementEnrollmentInput[]>();
  for (const enrollment of enrollments) {
    const entries = enrollmentsByStudent.get(enrollment.studentId) ?? [];
    entries.push(enrollment);
    enrollmentsByStudent.set(enrollment.studentId, entries);
  }
  const decisions = subscriptions.map((subscription) => {
    const academicRows = Object.freeze([
      ...(enrollmentsByStudent.get(subscription.studentId) ?? []),
    ]);
    const resolution = resolveScopes(subscription, academicRows);
    const consultedEnrollments = resolution.academicMapConsulted
      ? academicRows
      : Object.freeze([] as AriaEntitlementEnrollmentInput[]);
    const canMutate = resolution.classification === 'DETERMINISTIC_BACKFILL';
    const existingInput = canMutate
      ? input.existingEntitlements.get(subscription.id) ?? null
      : null;
    if (
      existingInput
      && (existingInput.productCode !== 'ARIA_ACCESS' || existingInput.userId !== subscription.userId)
    ) {
      throw new Error('ARIA_ENTITLEMENT_BACKFILL_TARGET_OWNERSHIP_CONFLICT');
    }
    const existing = existingInput ? Object.freeze({
      ...existingInput,
      scopes: freezeScopes([...existingInput.scopes].sort((left, right) =>
        compareText(`${left.kind}:${left.courseKey ?? ''}`, `${right.kind}:${right.courseKey ?? ''}`))),
    }) : null;
    const priorGeneration = canMutate ? input.priorGenerations.get(subscription.id) ?? 0 : -1;
    if (canMutate && (!Number.isInteger(priorGeneration) || priorGeneration < 0)) {
      throw new Error('ARIA_ENTITLEMENT_BACKFILL_GENERATION_INVALID');
    }
    const status = entitlementStatus(subscription.status);
    const desired = canMutate ? Object.freeze({
      status,
      startsAt: subscription.startDate,
      endsAt: subscription.endDate,
      suspendedAt: status === 'SUSPENDED' ? now : null,
      revokedAt: status === 'REVOKED' ? now : null,
      scopes: freezeScopes(resolution.scopes),
    }) : null;
    return Object.freeze({
      subscription,
      enrollments: consultedEnrollments,
      classification: resolution.classification,
      desired,
      existing,
      generation: canMutate ? priorGeneration + 1 : 0,
    });
  });
  const deterministic = decisions.filter(({ classification }) =>
    classification === 'DETERMINISTIC_BACKFILL').length;
  const archived = decisions.filter(({ classification }) =>
    classification === 'ARCHIVED_NON_RESUMABLE').length;
  const manualReview = decisions.filter(({ classification }) =>
    classification === 'MANUAL_REVIEW_REQUIRED').length;
  const counts = { scanned: decisions.length, deterministic, archived, manualReview };
  const snapshot = createAriaBackfillSnapshot({
    target: 'entitlements',
    plannerVersion: 1,
    inputs: { entitlementContract: { version: 1 } },
    units: decisions,
    report: counts,
  });
  const report = Object.freeze({
    ...counts,
    mutated: 0,
    sourceDigest: snapshot.sourceDigest,
    sourceSnapshot: snapshot.sourceSnapshot,
  });
  return Object.freeze({
    decisions: Object.freeze(decisions),
    report,
    sourceDigest: snapshot.sourceDigest,
    sourceSnapshot: snapshot.sourceSnapshot,
  });
}

async function executeBackfill(
  client: PoolClient,
  options: AriaEntitlementBackfillOptions,
): Promise<AriaEntitlementBackfillReport> {
  const subscriptions = await client.query<AriaEntitlementSubscriptionDbRow>(
    `SELECT sub.id, sub."studentId", student."userId", student."gradeLevel"::text,
            student."academicTrack"::text, student."stmgPathway"::text,
            sub.status::text, sub."startDate", sub."endDate", sub."ariaSubjects"
     FROM subscriptions sub JOIN students student ON student.id = sub."studentId"
     ORDER BY sub.id FOR UPDATE OF sub, student`,
  );
  const enrollmentRows = await client.query<AriaEntitlementEnrollmentInput>(
    `SELECT "studentId", "courseKey", kind::text, source::text
     FROM student_academic_enrollments ORDER BY "studentId", "courseKey" FOR SHARE`,
  );
  const subscriptionIds = subscriptions.rows.map(({ id }) => id);
  const [existingEntitlements, priorGenerations] = await Promise.all([
    loadPlannerTargetState(client, subscriptionIds),
    loadPlannerLineage(client, subscriptionIds),
  ]);
  const plan = planAriaEntitlementBackfill({
    subscriptions: subscriptions.rows,
    enrollments: enrollmentRows.rows,
    existingEntitlements,
    priorGenerations,
    now: options.now,
  });
  const { decisions } = plan;
  const { deterministic, archived, manualReview } = plan.report;
  if (options.mode === 'DRY_RUN') {
    return plan.report;
  }

  const insertedRun = await client.query<{ id: string }>(
    `INSERT INTO aria_data_migration_runs
      (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status)
     VALUES ($1, 'aria-entitlements-v1', 'APPLY', $2::jsonb, $3, 'RUNNING')
     ON CONFLICT ("migrationName", "sourceDigest", mode)
     DO NOTHING
     RETURNING id`,
    [
      options.runId,
      JSON.stringify(plan.sourceSnapshot),
      options.sourceDigest,
    ],
  );
  if (insertedRun.rowCount === 0) {
    const existingRun = await client.query<{
      status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
      scannedCount: number;
      deterministicCount: number;
      archivedCount: number;
      manualReviewCount: number;
      mutatedCount: number;
      sourceSnapshot: unknown;
    }>(
      `SELECT status::text, "scannedCount", "deterministicCount", "archivedCount",
              "manualReviewCount", "mutatedCount", "sourceSnapshot"
       FROM aria_data_migration_runs
       WHERE "migrationName" = 'aria-entitlements-v1' AND "sourceDigest" = $1
         AND mode = 'APPLY'
       FOR UPDATE`,
      [options.sourceDigest],
    );
    const existing = existingRun.rows[0];
    if (existing?.status === 'ROLLED_BACK') {
      throw new Error('ARIA_ENTITLEMENT_BACKFILL_RUN_ROLLED_BACK');
    }
    if (existing?.status !== 'COMPLETED') {
      throw new Error('ARIA_ENTITLEMENT_BACKFILL_RUN_NOT_REPLAYABLE');
    }
    const persistedSnapshot = persistedPlannerSnapshot(existing.sourceSnapshot);
    return {
      scanned: existing.scannedCount,
      deterministic: existing.deterministicCount,
      archived: existing.archivedCount,
      manualReview: existing.manualReviewCount,
      mutated: existing.mutatedCount,
      sourceDigest: persistedSnapshot.sourceSnapshotSha256,
      sourceSnapshot: persistedSnapshot,
    };
  }
  const runId = insertedRun.rows[0].id;
  let mutated = 0;
  for (const decision of decisions) {
    const { subscription } = decision;
    const beforeImage = {
      ariaSubjects: subscription.ariaSubjects,
      endDate: subscription.endDate,
      startDate: subscription.startDate,
      status: subscription.status,
      subscriptionId: subscription.id,
    };
    let targetId: string | null = null;
    if (decision.classification === 'DETERMINISTIC_BACKFILL') {
      const desired = decision.desired;
      if (!desired) throw new Error('ARIA_ENTITLEMENT_BACKFILL_PLAN_INVALID');
      const generation = decision.generation;
      const existingId = decision.existing?.id ?? null;
      const entitlementBefore = decision.existing && {
        status: decision.existing.status,
        startsAt: decision.existing.startsAt,
        endsAt: decision.existing.endsAt,
        suspendedAt: decision.existing.suspendedAt,
        revokedAt: decision.existing.revokedAt,
        scopes: decision.existing.scopes,
      };
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
          desired.status,
          databaseInstant(desired.startsAt),
          databaseInstant(desired.endsAt),
          subscription.id,
          databaseInstant(desired.suspendedAt),
          databaseInstant(desired.revokedAt),
        ],
      );
      targetId = entitlement.rows[0].id;
      await client.query('DELETE FROM aria_entitlement_scopes WHERE "entitlementId" = $1', [targetId]);
      for (const scope of desired.scopes) {
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
        generation,
        scopeCount: desired.scopes.length,
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
  return {
    ...plan.report,
    mutated,
  };
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
    readonly generation?: number;
  };
  readonly beforeImage: {
    readonly ariaSubjects: string;
    readonly endDate: string | null;
    readonly entitlement: EntitlementSnapshot | null;
    readonly startDate: string;
    readonly status: AriaEntitlementSubscriptionInput['status'];
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
      const generation = Number.isInteger(audit.targetKey.generation)
        && (audit.targetKey.generation ?? 0) > 0
        ? audit.targetKey.generation!
        : null;
      const supersedingRun = await client.query(
        `SELECT 1
         FROM aria_data_migration_row_audits later_audit
         JOIN aria_data_migration_runs later_run ON later_run.id = later_audit."runId"
         WHERE later_run."migrationName" = 'aria-entitlements-v1'
           AND later_run.status = 'COMPLETED'
           AND later_audit."runId" <> $1
           AND later_audit."sourceType" = 'ARIA_SUBSCRIPTION_ENTITLEMENT'
           AND later_audit."sourceId" = $2
           AND (
             $3::integer IS NULL
             OR CASE WHEN later_audit."targetKey"->>'generation' ~ '^[1-9][0-9]*$'
               THEN (later_audit."targetKey"->>'generation')::integer ELSE 1 END > $3
           )
         LIMIT 1`,
        [runId, audit.sourceId, generation],
      );
      if (supersedingRun.rowCount !== 0) {
        throw new Error('ARIA_ENTITLEMENT_ROLLBACK_RUN_SUPERSEDED');
      }
      const source = await client.query<AriaEntitlementSubscriptionDbRow>(
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
