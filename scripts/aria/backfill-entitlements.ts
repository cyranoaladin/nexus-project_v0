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
      mutated += 1;
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
        targetId ? JSON.stringify({ scopeCount: decision.scopes.length }) : null,
        JSON.stringify(beforeImage),
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
