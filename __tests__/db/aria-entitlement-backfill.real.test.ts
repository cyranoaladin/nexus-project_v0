/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool, type QueryResult } from 'pg';
import {
  backfillAriaEntitlements,
  rollbackAriaEntitlementBackfill,
  type AriaEntitlementBackfillOptions,
  type AriaEntitlementBackfillReport,
} from '@/scripts/aria/backfill-entitlements';
import { stableLegacyFingerprint } from '@/scripts/aria/audit-legacy-data';
import { createAriaBackfillSnapshot } from '@/scripts/aria/backfill-snapshot';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

async function waitForDatabaseCondition(
  condition: () => Promise<boolean>,
  timeoutMs = 2_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return false;
}

describe('ARIA entitlement backfill on PostgreSQL', () => {
  let pool: Pool;
  const ids = {
    parentUser: randomUUID(),
    parent: randomUUID(),
    studentUser: randomUUID(),
    student: randomUUID(),
    stmgUser: randomUUID(),
    stmgStudent: randomUUID(),
    activeSubscription: randomUUID(),
    mathsEnrollment: randomUUID(),
    physiqueEnrollment: randomUUID(),
    revokedSubscription: randomUUID(),
    inactiveSubscription: randomUUID(),
    expiredSubscription: randomUUID(),
    featureAliasSubscription: randomUUID(),
    stmgSubscription: randomUUID(),
    malformedSubscription: randomUUID(),
    structuredMalformedSubscription: randomUUID(),
    unsupportedCourseSubscription: randomUUID(),
    rollbackSubscription: randomUUID(),
  };

  async function sealEntitlementDryRun(
    requestedRunId: string,
    report: AriaEntitlementBackfillReport,
  ): Promise<string> {
    const auditRunId = `${requestedRunId}-audit`;
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "scannedCount", "deterministicCount", "archivedCount", "manualReviewCount",
         "mutatedCount", "completedAt")
       VALUES ($1, 'aria-entitlements-v1', 'DRY_RUN', $2::jsonb, $3, 'COMPLETED',
               $4, $5, $6, $7, 0, NOW())
       ON CONFLICT ("migrationName", "sourceDigest", mode) DO NOTHING
       RETURNING id`,
      [
        auditRunId,
        JSON.stringify(report.sourceSnapshot),
        report.sourceDigest,
        report.scanned,
        report.deterministic,
        report.archived,
        report.manualReview,
      ],
    );
    if (inserted.rowCount === 1) return inserted.rows[0].id;
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM aria_data_migration_runs
       WHERE "migrationName" = 'aria-entitlements-v1' AND mode = 'DRY_RUN'
         AND "sourceDigest" = $1`,
      [report.sourceDigest],
    );
    if (existing.rowCount !== 1) throw new Error('ARIA_TEST_ENTITLEMENT_AUDIT_SEAL_FAILED');
    return existing.rows[0].id;
  }

  async function prepareEntitlementApply(
    runId: string,
    now = new Date('2026-08-30T12:00:00.000Z'),
  ): Promise<AriaEntitlementBackfillOptions> {
    const dryRun = await backfillAriaEntitlements(pool, {
      runId,
      mode: 'DRY_RUN',
      sourceDigest: '0'.repeat(64),
      now,
    });
    const prerequisiteRunId = await sealEntitlementDryRun(runId, dryRun);
    return {
      runId,
      mode: 'APPLY',
      sourceDigest: dryRun.sourceDigest,
      prerequisiteRunId,
      now,
    };
  }

  function singleEntitlementSnapshot(label: string) {
    return createAriaBackfillSnapshot({
      target: 'entitlements',
      plannerVersion: 1,
      inputs: { entitlementContract: { version: 1 } },
      units: [{ label }],
      report: { scanned: 1, deterministic: 1, archived: 0, manualReview: 0 },
    });
  }

  async function createOwnedEntitlementTarget(): Promise<{
    sourceId: string;
    targetId: string;
    afterFingerprint: string;
  }> {
    const sourceId = randomUUID();
    const targetId = randomUUID();
    await pool.query(
      `INSERT INTO subscriptions
        (id, "studentId", "planName", "monthlyPrice", "creditsPerMonth", status,
         "startDate", "endDate", "ariaSubjects", "updatedAt")
       VALUES ($1, $2, 'ARIA', 0, 0, 'ACTIVE', '2030-01-01 00:00:00',
               '2030-12-31 00:00:00', $3, NOW())`,
      [sourceId, ids.student, JSON.stringify(['ALL'])],
    );
    await pool.query(
      `INSERT INTO entitlements
        (id, "userId", "productCode", label, status, "startsAt",
         "sourceSubscriptionId", "createdAt", "updatedAt")
       VALUES ($1, $2, 'ARIA_ACCESS', 'Accès ARIA', 'ACTIVE',
               '2030-01-01 00:00:00', $3, NOW(), NOW())`,
      [targetId, ids.studentUser, sourceId],
    );
    const target = await pool.query<{
      status: string;
      startsAt: string;
      endsAt: string | null;
      suspendedAt: string | null;
      revokedAt: string | null;
    }>(
      `SELECT status::text,
              to_char("startsAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "startsAt",
              to_char("endsAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "endsAt",
              to_char("suspendedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "suspendedAt",
              to_char("revokedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "revokedAt"
       FROM entitlements WHERE id = $1`,
      [targetId],
    );
    return {
      sourceId,
      targetId,
      afterFingerprint: stableLegacyFingerprint({ ...target.rows[0], scopes: [] }),
    };
  }

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
        ($1, $2, 'PARENT', NOW()),
        ($3, $4, 'ELEVE', NOW()),
        ($5, $6, 'ELEVE', NOW())`,
      [
        ids.parentUser,
        `parent-${ids.parentUser}@invalid.test`,
        ids.studentUser,
        `student-${ids.studentUser}@invalid.test`,
        ids.stmgUser,
        `student-${ids.stmgUser}@invalid.test`,
      ],
    );
    await pool.query(
      'INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)',
      [ids.parent, ids.parentUser],
    );
    await pool.query(
      `INSERT INTO students
        (id, "parentId", "userId", "gradeLevel", "academicTrack", "updatedAt") VALUES
        ($1, $2, $3, 'PREMIERE', 'EDS_GENERALE', NOW()),
        ($4, $2, $5, 'PREMIERE', 'STMG', NOW())`,
      [ids.student, ids.parent, ids.studentUser, ids.stmgStudent, ids.stmgUser],
    );
    await pool.query(
      `INSERT INTO student_academic_enrollments
        (id, "studentId", "courseKey", kind, source, "curriculumVersion", "createdAt", "updatedAt")
       VALUES ($1, $2, 'eds-maths-premiere', 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW()),
              ($3, $2, 'eds-physique-chimie-premiere', 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW())`,
      [ids.mathsEnrollment, ids.student, ids.physiqueEnrollment],
    );
    await pool.query(
      `INSERT INTO subscriptions
        (id, "studentId", "planName", "monthlyPrice", "creditsPerMonth", status,
         "startDate", "endDate", "ariaSubjects", "updatedAt") VALUES
        ($1, $3, 'ARIA', 0, 0, 'ACTIVE', NOW() - INTERVAL '10 days',
         NOW() + INTERVAL '20 days', $4, NOW()),
        ($2, $3, 'ARIA', 0, 0, 'CANCELLED', NOW() - INTERVAL '20 days',
         NOW() - INTERVAL '1 day', $5, NOW()),
        ($6, $3, 'ARIA', 0, 0, 'INACTIVE', NOW() - INTERVAL '20 days',
         NOW() + INTERVAL '20 days', $4, NOW()),
        ($7, $3, 'ARIA', 0, 0, 'EXPIRED', NOW() - INTERVAL '40 days',
         NOW() - INTERVAL '10 days', $4, NOW()),
        ($8, $3, 'ARIA', 0, 0, 'ACTIVE', NOW() - INTERVAL '10 days',
         NOW() + INTERVAL '20 days', $9, NOW()),
        ($10, $11, 'ARIA', 0, 0, 'ACTIVE', NOW() - INTERVAL '10 days',
         NOW() + INTERVAL '20 days', $12, NOW()),
        ($13, $3, 'ARIA', 0, 0, 'ACTIVE', NOW() - INTERVAL '10 days',
         NOW() + INTERVAL '20 days', $14, NOW()),
        ($15, $3, 'ARIA', 0, 0, 'ACTIVE', NOW() - INTERVAL '10 days',
         NOW() + INTERVAL '20 days', $16, NOW()),
        ($17, $3, 'ARIA', 0, 0, 'ACTIVE', NOW() - INTERVAL '10 days',
         NOW() + INTERVAL '20 days', $18, NOW())`,
      [
        ids.activeSubscription,
        ids.revokedSubscription,
        ids.student,
        JSON.stringify(['eds-maths-premiere']),
        JSON.stringify(['ALL']),
        ids.inactiveSubscription,
        ids.expiredSubscription,
        ids.featureAliasSubscription,
        JSON.stringify(['aria_maths']),
        ids.stmgSubscription,
        ids.stmgStudent,
        JSON.stringify(['stmg-sgn-premiere']),
        ids.malformedSubscription,
        JSON.stringify(['unknown-entitlement-key']),
        ids.structuredMalformedSubscription,
        JSON.stringify([42]),
        ids.unsupportedCourseSubscription,
        JSON.stringify(['eds-physique-chimie-premiere']),
      ],
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [ids.parentUser]);
    await pool.end();
  });

  it('B3_APPLY_REJECTS_SAME_COUNT_SOURCE_SNAPSHOT_DRIFT', async () => {
    const options = await prepareEntitlementApply(randomUUID());
    await pool.query(
      'UPDATE subscriptions SET "ariaSubjects" = $2 WHERE id = $1',
      [ids.activeSubscription, JSON.stringify(['eds-physique-chimie-premiere'])],
    );
    const outcome = await backfillAriaEntitlements(pool, options)
      .then(() => 'RESOLVED', (error: Error) => error.message);
    if (outcome === 'RESOLVED') {
      await rollbackAriaEntitlementBackfill(pool, options.runId);
    }
    await pool.query(
      'UPDATE subscriptions SET "ariaSubjects" = $2 WHERE id = $1',
      [ids.activeSubscription, JSON.stringify(['eds-maths-premiere'])],
    );
    expect(outcome).toBe('ARIA_ENTITLEMENT_SOURCE_SNAPSHOT_MISMATCH');
  });

  it('B3_APPLY_PREREQUISITE_CANNOT_BECOME_ROLLED_BACK_AFTER_CHILD_EXISTS', async () => {
    const dryRun = await backfillAriaEntitlements(pool, {
      runId: randomUUID(),
      mode: 'DRY_RUN',
      sourceDigest: '0'.repeat(64),
      now: new Date('2031-01-01T00:00:00.000Z'),
    });
    const prerequisiteRunId = await sealEntitlementDryRun(randomUUID(), dryRun);
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId")
       VALUES ($1, 'aria-entitlements-v1', 'APPLY', $2::jsonb, $3, 'RUNNING', $4)`,
      [randomUUID(), JSON.stringify(dryRun.sourceSnapshot), dryRun.sourceDigest, prerequisiteRunId],
    );

    await expect(pool.query(
      `UPDATE aria_data_migration_runs
       SET status = 'ROLLED_BACK', "completedAt" = NOW()
       WHERE id = $1`,
      [prerequisiteRunId],
    )).rejects.toMatchObject({
      code: 'P0001',
      message: expect.stringContaining('only APPLY migration runs can be rolled back'),
    });
    await expect(pool.query(
      'SELECT status::text FROM aria_data_migration_runs WHERE id = $1',
      [prerequisiteRunId],
    )).resolves.toMatchObject({ rows: [{ status: 'COMPLETED' }] });
  });

  it('B3_APPLY_INSERT_SERIALIZES_WITH_CONCURRENT_PREREQUISITE_UPDATE', async () => {
    const snapshot = singleEntitlementSnapshot('prerequisite-lock-race');
    const prerequisiteRunId = randomUUID();
    const applyRunId = randomUUID();
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "scannedCount", "deterministicCount", "completedAt")
       VALUES ($1, 'aria-entitlements-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', 1, 1, NOW())`,
      [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
    );
    const racePool = new Pool({ connectionString: databaseUrl, max: 3 });
    const locker = await racePool.connect();
    const childWriter = await racePool.connect();
    let childInsert: Promise<QueryResult> | undefined;
    try {
      const childPid = await childWriter.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      await locker.query('BEGIN');
      await locker.query(
        `UPDATE aria_data_migration_runs SET "completedAt" = "completedAt" WHERE id = $1`,
        [prerequisiteRunId],
      );
      childInsert = childWriter.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "prerequisiteRunId")
         VALUES ($1, 'aria-entitlements-v1', 'APPLY', $2::jsonb, $3, 'RUNNING', $4)`,
        [applyRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
      );
      const blocked = await waitForDatabaseCondition(async () => {
        const state = await pool.query<{ waitEventType: string | null }>(
          `SELECT wait_event_type AS "waitEventType" FROM pg_stat_activity WHERE pid = $1`,
          [childPid.rows[0].pid],
        );
        return state.rows[0]?.waitEventType === 'Lock';
      });
      expect(blocked).toBe(true);
      await locker.query('COMMIT');
      await expect(childInsert).resolves.toMatchObject({ rowCount: 1 });
      await expect(pool.query(
        'SELECT status::text FROM aria_data_migration_runs WHERE id = $1',
        [prerequisiteRunId],
      )).resolves.toMatchObject({ rows: [{ status: 'COMPLETED' }] });
    } finally {
      await locker.query('ROLLBACK');
      await childInsert?.catch(() => undefined);
      locker.release();
      childWriter.release();
      await racePool.end();
    }
  });

  it('B3_APPLY_CANNOT_BE_BORN_COMPLETED_WITHOUT_ROW_EVIDENCE', async () => {
    const prerequisiteRunId = randomUUID();
    const applyRunId = randomUUID();
    const digest = applyRunId.replaceAll('-', '').repeat(2);
    const snapshot = { testCase: 'born-completed', digest };
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "completedAt")
       VALUES ($1, 'aria-entitlements-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', NOW())`,
      [prerequisiteRunId, JSON.stringify(snapshot), digest],
    );

    await expect(pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId", "completedAt")
       VALUES ($1, 'aria-entitlements-v1', 'APPLY', $2::jsonb, $3,
               'COMPLETED', $4, NOW())`,
      [applyRunId, JSON.stringify(snapshot), digest, prerequisiteRunId],
    )).rejects.toMatchObject({
      code: 'P0001',
      message: expect.stringContaining('APPLY migration run must start RUNNING'),
    });
  });

  it('B3_APPLY_TERMINALIZATION_REQUIRES_EXACT_ROW_EVIDENCE', async () => {
    const prerequisiteRunId = randomUUID();
    const applyRunId = randomUUID();
    const digest = applyRunId.replaceAll('-', '').repeat(2);
    const snapshot = {
      schemaVersion: 1,
      target: 'entitlements',
      plannerVersion: 1,
      inputDigests: {},
      unitsSha256: 'a'.repeat(64),
      report: { scanned: 1, deterministic: 1, archived: 0, manualReview: 0 },
      sourceSnapshotSha256: digest,
    };
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "completedAt")
       VALUES ($1, 'aria-entitlements-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', NOW())`,
      [prerequisiteRunId, JSON.stringify(snapshot), digest],
    );
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId")
       VALUES ($1, 'aria-entitlements-v1', 'APPLY', $2::jsonb, $3,
               'RUNNING', $4)`,
      [applyRunId, JSON.stringify(snapshot), digest, prerequisiteRunId],
    );

    await expect(pool.query(
      `UPDATE aria_data_migration_runs
       SET status = 'COMPLETED', "scannedCount" = 1, "deterministicCount" = 1,
           "mutatedCount" = 1, "completedAt" = NOW()
       WHERE id = $1`,
      [applyRunId],
    )).rejects.toMatchObject({
      code: 'P0001',
      message: expect.stringContaining('APPLY terminal evidence does not match row audits'),
    });
  });

  it('B3_TERMINALIZATION_REJECTS_FORGED_TARGET_EVIDENCE', async () => {
    const prerequisiteRunId = randomUUID();
    const applyRunId = randomUUID();
    const snapshot = singleEntitlementSnapshot('terminal-forged-target');
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "scannedCount", "deterministicCount", "completedAt")
       VALUES ($1, 'aria-entitlements-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', 1, 1, NOW())`,
      [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
    );
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId")
       VALUES ($1, 'aria-entitlements-v1', 'APPLY', $2::jsonb, $3,
               'RUNNING', $4)`,
      [applyRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
    );
    await pool.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
         "targetTable", "targetId", "targetKey", "beforeImage")
       VALUES ($1, $2, 'ARIA_SUBSCRIPTION_ENTITLEMENT', $3, $4,
               'DETERMINISTIC_BACKFILL', 'entitlements', $5, $6::jsonb, $7::jsonb)`,
      [
        randomUUID(),
        applyRunId,
        randomUUID(),
        'a'.repeat(64),
        randomUUID(),
        JSON.stringify({
          afterFingerprint: 'b'.repeat(64),
          academicMapConsulted: false,
          created: true,
          generation: 1,
          scopeCount: 1,
        }),
        JSON.stringify({
          ariaSubjects: '["ALL"]',
          endDate: null,
          entitlement: null,
          startDate: '2030-01-01T00:00:00.000Z',
          status: 'ACTIVE',
          subscriptionId: randomUUID(),
        }),
      ],
    );

    await expect(pool.query(
      `UPDATE aria_data_migration_runs
       SET status = 'COMPLETED', "scannedCount" = 1, "deterministicCount" = 1,
           "mutatedCount" = 1, "completedAt" = NOW()
       WHERE id = $1`,
      [applyRunId],
    )).rejects.toMatchObject({
      code: 'P0001',
      message: expect.stringContaining('APPLY terminal evidence does not match row audits'),
    });
  });

  it('B3_TERMINALIZATION_REJECTS_FORGED_NONDETERMINISTIC_SOURCE_EVIDENCE', async () => {
    const prerequisiteRunId = randomUUID();
    const applyRunId = randomUUID();
    const sourceId = randomUUID();
    const snapshot = createAriaBackfillSnapshot({
      target: 'entitlements',
      plannerVersion: 1,
      inputs: { entitlementContract: { version: 1 } },
      units: [{ label: 'terminal-forged-nondeterministic-source' }],
      report: { scanned: 1, deterministic: 0, archived: 0, manualReview: 1 },
    });
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "scannedCount", "manualReviewCount", "completedAt")
       VALUES ($1, 'aria-entitlements-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', 1, 1, NOW())`,
      [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
    );
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId")
       VALUES ($1, 'aria-entitlements-v1', 'APPLY', $2::jsonb, $3,
               'RUNNING', $4)`,
      [applyRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
    );
    await pool.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
         "targetTable", "targetId", "targetKey", "beforeImage")
       VALUES ($1, $2, 'ARIA_SUBSCRIPTION_ENTITLEMENT', $3, $4,
               'MANUAL_REVIEW_REQUIRED', NULL, NULL, NULL, '{}'::jsonb)`,
      [randomUUID(), applyRunId, sourceId, '9'.repeat(64)],
    );

    await expect(pool.query(
      `UPDATE aria_data_migration_runs
       SET status = 'COMPLETED', "scannedCount" = 1, "manualReviewCount" = 1,
           "completedAt" = NOW()
       WHERE id = $1`,
      [applyRunId],
    )).rejects.toMatchObject({
      code: 'P0001',
      message: expect.stringContaining('APPLY terminal evidence does not match row audits'),
    });
  });

  it('B3_TERMINALIZATION_REJECTS_NULL_AFTER_FINGERPRINT', async () => {
    const prerequisiteRunId = randomUUID();
    const applyRunId = randomUUID();
    const ownedTarget = await createOwnedEntitlementTarget();
    const snapshot = singleEntitlementSnapshot('terminal-null-fingerprint');
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "scannedCount", "deterministicCount", "completedAt")
       VALUES ($1, 'aria-entitlements-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', 1, 1, NOW())`,
      [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
    );
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId")
       VALUES ($1, 'aria-entitlements-v1', 'APPLY', $2::jsonb, $3,
               'RUNNING', $4)`,
      [applyRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
    );
    await pool.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
         "targetTable", "targetId", "targetKey", "beforeImage")
       VALUES ($1, $2, 'ARIA_SUBSCRIPTION_ENTITLEMENT', $3, $4,
               'DETERMINISTIC_BACKFILL', 'entitlements', $5, $6::jsonb, $7::jsonb)`,
      [
        randomUUID(),
        applyRunId,
        ownedTarget.sourceId,
        'e'.repeat(64),
        ownedTarget.targetId,
        JSON.stringify({
          afterFingerprint: null,
          academicMapConsulted: false,
          created: true,
          generation: 1,
          scopeCount: 0,
        }),
        JSON.stringify({
          ariaSubjects: '["ALL"]',
          endDate: null,
          entitlement: null,
          startDate: '2030-01-01T00:00:00.000Z',
          status: 'ACTIVE',
          subscriptionId: ownedTarget.sourceId,
        }),
      ],
    );

    await expect(pool.query(
      `UPDATE aria_data_migration_runs
       SET status = 'COMPLETED', "scannedCount" = 1, "deterministicCount" = 1,
           "mutatedCount" = 1, "completedAt" = NOW()
       WHERE id = $1`,
      [applyRunId],
    )).rejects.toMatchObject({
      code: 'P0001',
      message: expect.stringContaining('APPLY terminal evidence does not match row audits'),
    });
    await expect(pool.query(
      'SELECT status::text FROM aria_data_migration_runs WHERE id = $1',
      [applyRunId],
    )).resolves.toMatchObject({ rows: [{ status: 'RUNNING' }] });
    await pool.query('DELETE FROM entitlements WHERE id = $1', [ownedTarget.targetId]);
    await pool.query('DELETE FROM subscriptions WHERE id = $1', [ownedTarget.sourceId]);
  });

  it('B3_TERMINALIZATION_REJECTS_INCOMPLETE_ROLLBACK_BEFORE_IMAGE', async () => {
    const prerequisiteRunId = randomUUID();
    const applyRunId = randomUUID();
    const ownedTarget = await createOwnedEntitlementTarget();
    const snapshot = singleEntitlementSnapshot('terminal-incomplete-before-image');
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "scannedCount", "deterministicCount", "completedAt")
       VALUES ($1, 'aria-entitlements-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', 1, 1, NOW())`,
      [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
    );
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId")
       VALUES ($1, 'aria-entitlements-v1', 'APPLY', $2::jsonb, $3,
               'RUNNING', $4)`,
      [applyRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
    );
    await pool.query(
      `INSERT INTO aria_data_migration_row_audits
        (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
         "targetTable", "targetId", "targetKey", "beforeImage")
       VALUES ($1, $2, 'ARIA_SUBSCRIPTION_ENTITLEMENT', $3, $4,
               'DETERMINISTIC_BACKFILL', 'entitlements', $5, $6::jsonb, $7::jsonb)`,
      [
        randomUUID(),
        applyRunId,
        ownedTarget.sourceId,
        'f'.repeat(64),
        ownedTarget.targetId,
        JSON.stringify({
          afterFingerprint: ownedTarget.afterFingerprint,
          academicMapConsulted: false,
          created: false,
          generation: 1,
          scopeCount: 0,
        }),
        JSON.stringify({ subscriptionId: ownedTarget.sourceId }),
      ],
    );

    await expect(pool.query(
      `UPDATE aria_data_migration_runs
       SET status = 'COMPLETED', "scannedCount" = 1, "deterministicCount" = 1,
           "mutatedCount" = 1, "completedAt" = NOW()
       WHERE id = $1`,
      [applyRunId],
    )).rejects.toMatchObject({
      code: 'P0001',
      message: expect.stringContaining('APPLY terminal evidence does not match row audits'),
    });
    await expect(pool.query(
      'SELECT status::text FROM aria_data_migration_runs WHERE id = $1',
      [applyRunId],
    )).resolves.toMatchObject({ rows: [{ status: 'RUNNING' }] });
    await pool.query('DELETE FROM entitlements WHERE id = $1', [ownedTarget.targetId]);
    await pool.query('DELETE FROM subscriptions WHERE id = $1', [ownedTarget.sourceId]);
  });

  it('D018 ARIA-B-R026 is repeatable and concurrency-safe with status on Entitlement and strict child scopes', async () => {
    const options = await prepareEntitlementApply(randomUUID());
    await Promise.all([
      backfillAriaEntitlements(pool, options),
      backfillAriaEntitlements(pool, options),
    ]);
    await backfillAriaEntitlements(pool, options);

    const entitlements = await pool.query<{
      sourceSubscriptionId: string;
      status: string;
    }>(
      `SELECT "sourceSubscriptionId", status::text
       FROM entitlements WHERE "sourceSubscriptionId" = ANY($1::text[])
       ORDER BY "sourceSubscriptionId"`,
      [[
        ids.activeSubscription,
        ids.revokedSubscription,
        ids.inactiveSubscription,
        ids.expiredSubscription,
        ids.featureAliasSubscription,
        ids.stmgSubscription,
        ids.malformedSubscription,
      ]],
    );
    expect(entitlements.rowCount).toBe(6);
    expect(new Map(entitlements.rows.map((row) => [row.sourceSubscriptionId, row.status]))).toEqual(
      new Map([
        [ids.activeSubscription, 'ACTIVE'],
        [ids.revokedSubscription, 'REVOKED'],
        [ids.inactiveSubscription, 'SUSPENDED'],
        [ids.expiredSubscription, 'EXPIRED'],
        [ids.featureAliasSubscription, 'ACTIVE'],
        [ids.stmgSubscription, 'ACTIVE'],
      ]),
    );
    const scopes = await pool.query<{
      sourceSubscriptionId: string;
      kind: string;
      courseKey: string | null;
      status: string;
    }>(
      `SELECT e."sourceSubscriptionId", s.kind::text, s."courseKey", e.status::text
       FROM aria_entitlement_scopes s JOIN entitlements e ON e.id = s."entitlementId"
       WHERE e."sourceSubscriptionId" = ANY($1::text[])
       ORDER BY e."sourceSubscriptionId", s.kind`,
      [[
        ids.activeSubscription,
        ids.revokedSubscription,
        ids.inactiveSubscription,
        ids.expiredSubscription,
        ids.featureAliasSubscription,
        ids.stmgSubscription,
        ids.malformedSubscription,
      ]],
    );
    expect(new Map(scopes.rows.map((row) => [row.sourceSubscriptionId, {
      kind: row.kind,
      courseKey: row.courseKey,
      status: row.status,
    }]))).toEqual(new Map([
      [ids.activeSubscription, { kind: 'COURSE', courseKey: 'eds-maths-premiere', status: 'ACTIVE' }],
      [ids.revokedSubscription, { kind: 'GLOBAL', courseKey: null, status: 'REVOKED' }],
      [ids.inactiveSubscription, { kind: 'COURSE', courseKey: 'eds-maths-premiere', status: 'SUSPENDED' }],
      [ids.expiredSubscription, { kind: 'COURSE', courseKey: 'eds-maths-premiere', status: 'EXPIRED' }],
      [ids.featureAliasSubscription, { kind: 'COURSE', courseKey: 'eds-maths-premiere', status: 'ACTIVE' }],
      [ids.stmgSubscription, { kind: 'COURSE', courseKey: 'stmg-sgn-premiere', status: 'ACTIVE' }],
    ]));

    expect(entitlements.rows.some(
      (row) => row.sourceSubscriptionId === ids.malformedSubscription,
    )).toBe(false);
    const manualAudit = await pool.query<{ classification: string; targetId: string | null }>(
      `SELECT classification::text, "targetId"
       FROM aria_data_migration_row_audits
       WHERE "sourceType" = 'ARIA_SUBSCRIPTION_ENTITLEMENT' AND "sourceId" = $1`,
      [ids.malformedSubscription],
    );
    expect(manualAudit.rows).toEqual([
      { classification: 'MANUAL_REVIEW_REQUIRED', targetId: null },
    ]);
  });

  it('separates malformed grant data from empty grants and commercial scope from product support', async () => {
    const malformedAudit = await pool.query<{ classification: string; targetId: string | null }>(
      `SELECT classification::text, "targetId"
       FROM aria_data_migration_row_audits
       WHERE "sourceType" = 'ARIA_SUBSCRIPTION_ENTITLEMENT' AND "sourceId" = $1`,
      [ids.structuredMalformedSubscription],
    );
    expect(malformedAudit.rows).toEqual([
      { classification: 'MANUAL_REVIEW_REQUIRED', targetId: null },
    ]);

    const unsupportedScope = await pool.query<{ courseKey: string; productCode: string }>(
      `SELECT scope."courseKey", entitlement."productCode"
       FROM entitlements entitlement
       JOIN aria_entitlement_scopes scope ON scope."entitlementId" = entitlement.id
       WHERE entitlement."sourceSubscriptionId" = $1`,
      [ids.unsupportedCourseSubscription],
    );
    expect(unsupportedScope.rows).toEqual([{
      courseKey: 'eds-physique-chimie-premiere', productCode: 'ARIA_ACCESS',
    }]);
  });

  it('restores pre-existing canonical state and removes only targets created by its run', async () => {
    const existing = await pool.query<{ id: string }>(
      'SELECT id FROM entitlements WHERE "sourceSubscriptionId" = $1',
      [ids.activeSubscription],
    );
    const existingId = existing.rows[0].id;
    const originalStart = new Date('2026-07-01T00:00:00.000Z');
    const originalSuspendedAt = new Date('2026-07-15T00:00:00.000Z');
    await pool.query(
      `UPDATE entitlements SET status = 'SUSPENDED', "startsAt" = $2, "endsAt" = NULL,
         "suspendedAt" = $3, "revokedAt" = NULL WHERE id = $1`,
      [existingId, originalStart, originalSuspendedAt],
    );
    await pool.query('DELETE FROM aria_entitlement_scopes WHERE "entitlementId" = $1', [existingId]);
    await pool.query(
      `INSERT INTO aria_entitlement_scopes
        (id, "entitlementId", kind, "courseKey", "createdAt", "updatedAt")
       VALUES ($1, $2, 'GLOBAL', NULL, NOW(), NOW())`,
      [randomUUID(), existingId],
    );
    const beforeApply = await pool.query<{
      status: string;
      startsAt: Date;
      endsAt: Date | null;
      suspendedAt: Date | null;
      revokedAt: Date | null;
      scopeKind: string;
      courseKey: string | null;
    }>(
      `SELECT entitlement.status::text, entitlement."startsAt", entitlement."endsAt",
              entitlement."suspendedAt", entitlement."revokedAt", scope.kind::text AS "scopeKind",
              scope."courseKey"
       FROM entitlements entitlement
       JOIN aria_entitlement_scopes scope ON scope."entitlementId" = entitlement.id
       WHERE entitlement.id = $1`,
      [existingId],
    );
    await pool.query(
      `INSERT INTO subscriptions
        (id, "studentId", "planName", "monthlyPrice", "creditsPerMonth", status,
         "startDate", "endDate", "ariaSubjects", "updatedAt")
       VALUES ($1, $2, 'ARIA', 0, 0, 'ACTIVE', NOW() - INTERVAL '2 days',
         NOW() + INTERVAL '10 days', $3, NOW())`,
      [ids.rollbackSubscription, ids.student, JSON.stringify(['eds-maths-premiere'])],
    );
    const runId = randomUUID();
    await backfillAriaEntitlements(pool, await prepareEntitlementApply(runId));
    expect(await pool.query(
      'SELECT id FROM entitlements WHERE "sourceSubscriptionId" = $1',
      [ids.rollbackSubscription],
    )).toMatchObject({ rowCount: 1 });

    await expect(rollbackAriaEntitlementBackfill(pool, runId)).resolves.toEqual({
      entitlementsDeleted: 1,
      entitlementsRestored: 7,
    });

    const restored = await pool.query<{
      status: string;
      startsAt: Date;
      endsAt: Date | null;
      suspendedAt: Date | null;
      revokedAt: Date | null;
      scopeKind: string;
      courseKey: string | null;
    }>(
      `SELECT entitlement.status::text, entitlement."startsAt", entitlement."endsAt",
              entitlement."suspendedAt", entitlement."revokedAt", scope.kind::text AS "scopeKind",
              scope."courseKey"
       FROM entitlements entitlement
       JOIN aria_entitlement_scopes scope ON scope."entitlementId" = entitlement.id
       WHERE entitlement.id = $1`,
      [existingId],
    );
    expect(restored.rows).toEqual(beforeApply.rows);
    expect(await pool.query(
      'SELECT id FROM entitlements WHERE "sourceSubscriptionId" = $1',
      [ids.rollbackSubscription],
    )).toMatchObject({ rowCount: 0 });
    await expect(rollbackAriaEntitlementBackfill(pool, runId))
      .rejects.toThrow('ARIA_ENTITLEMENT_ROLLBACK_RUN_NOT_COMPLETED');
  });

  it('fails the whole rollback transaction when canonical target state drifted', async () => {
    const runId = randomUUID();
    await backfillAriaEntitlements(pool, await prepareEntitlementApply(runId));
    await pool.query(
      `UPDATE entitlements SET status = 'SUSPENDED'
       WHERE "sourceSubscriptionId" = $1`,
      [ids.activeSubscription],
    );
    await expect(rollbackAriaEntitlementBackfill(pool, runId))
      .rejects.toThrow('ARIA_ENTITLEMENT_ROLLBACK_TARGET_CONFLICT');
    const run = await pool.query<{ status: string }>(
      'SELECT status::text FROM aria_data_migration_runs WHERE id = $1',
      [runId],
    );
    expect(run.rows).toEqual([{ status: 'COMPLETED' }]);
  });

  it('fails closed when the legacy subscription source changed after apply', async () => {
    const runId = randomUUID();
    await backfillAriaEntitlements(pool, await prepareEntitlementApply(runId));
    await pool.query(
      'UPDATE subscriptions SET "ariaSubjects" = $2 WHERE id = $1',
      [ids.activeSubscription, JSON.stringify(['ALL'])],
    );
    await expect(rollbackAriaEntitlementBackfill(pool, runId))
      .rejects.toThrow('ARIA_ENTITLEMENT_ROLLBACK_SOURCE_CONFLICT');
    expect(await pool.query(
      'SELECT status::text FROM aria_data_migration_runs WHERE id = $1',
      [runId],
    )).toMatchObject({ rows: [{ status: 'COMPLETED' }] });
  });

  it('B3_ROLLBACK_REJECTS_CONSULTED_ENROLLMENT_DRIFT', async () => {
    const runId = randomUUID();
    await backfillAriaEntitlements(pool, await prepareEntitlementApply(runId));
    await pool.query(
      `UPDATE student_academic_enrollments SET source = 'SEED', "updatedAt" = NOW()
       WHERE id = $1`,
      [ids.mathsEnrollment],
    );

    await expect(rollbackAriaEntitlementBackfill(pool, runId))
      .rejects.toThrow('ARIA_ENTITLEMENT_ROLLBACK_SOURCE_CONFLICT');
    await expect(pool.query(
      'SELECT status::text FROM aria_data_migration_runs WHERE id = $1',
      [runId],
    )).resolves.toMatchObject({ rows: [{ status: 'COMPLETED' }] });

    await pool.query(
      `UPDATE student_academic_enrollments SET source = 'ADMIN', "updatedAt" = NOW()
       WHERE id = $1`,
      [ids.mathsEnrollment],
    );
    await expect(rollbackAriaEntitlementBackfill(pool, runId)).resolves.toBeDefined();
  });

  it('B3_ROLLBACK_REJECTS_CONSULTED_ACADEMIC_PROFILE_DRIFT', async () => {
    const runId = randomUUID();
    await backfillAriaEntitlements(pool, await prepareEntitlementApply(runId));
    await pool.query(
      `UPDATE students SET "gradeLevel" = 'TERMINALE', "updatedAt" = NOW()
       WHERE id = $1`,
      [ids.student],
    );

    await expect(rollbackAriaEntitlementBackfill(pool, runId))
      .rejects.toThrow('ARIA_ENTITLEMENT_ROLLBACK_SOURCE_CONFLICT');
    await expect(pool.query(
      'SELECT status::text FROM aria_data_migration_runs WHERE id = $1',
      [runId],
    )).resolves.toMatchObject({ rows: [{ status: 'COMPLETED' }] });

    await pool.query(
      `UPDATE students SET "gradeLevel" = 'PREMIERE', "updatedAt" = NOW()
       WHERE id = $1`,
      [ids.student],
    );
    await expect(rollbackAriaEntitlementBackfill(pool, runId)).resolves.toBeDefined();
  });

  it('ENTITLEMENT_REAPPLY_AFTER_ROLLBACK_REBUILDS_CANONICAL_AUDIT_IDENTITY', async () => {
    const subscriptionId = randomUUID();
    const runId = randomUUID();
    await pool.query(
      `INSERT INTO subscriptions
        (id, "studentId", "planName", "monthlyPrice", "creditsPerMonth", status,
         "startDate", "endDate", "ariaSubjects", "updatedAt")
       VALUES ($1, $2, 'ARIA', 0, 0, 'ACTIVE', NOW() - INTERVAL '2 days',
         NOW() + INTERVAL '10 days', $3, NOW())`,
      [subscriptionId, ids.student, JSON.stringify(['eds-maths-premiere'])],
    );
    const options = await prepareEntitlementApply(runId);
    await backfillAriaEntitlements(pool, options);
    await rollbackAriaEntitlementBackfill(pool, runId);

    await expect(backfillAriaEntitlements(pool, {
      ...options, runId: randomUUID(),
    })).rejects.toThrow('ARIA_ENTITLEMENT_BACKFILL_RUN_ROLLED_BACK');

    expect(await pool.query(
      'SELECT id FROM entitlements WHERE "sourceSubscriptionId" = $1',
      [subscriptionId],
    )).toMatchObject({ rowCount: 0 });
  });

  it('ENTITLEMENT_ROLLBACK_REJECTS_SUPERSEDED_MIGRATION_RUN', async () => {
    const subscriptionId = randomUUID();
    await pool.query(
      `INSERT INTO subscriptions
        (id, "studentId", "planName", "monthlyPrice", "creditsPerMonth", status,
         "startDate", "endDate", "ariaSubjects", "updatedAt")
       VALUES ($1, $2, 'ARIA', 0, 0, 'ACTIVE', NOW() - INTERVAL '2 days',
         NOW() + INTERVAL '10 days', $3, NOW())`,
      [subscriptionId, ids.student, JSON.stringify(['eds-maths-premiere'])],
    );
    const earlierRunId = randomUUID();
    await backfillAriaEntitlements(pool, await prepareEntitlementApply(earlierRunId));
    const laterRunId = randomUUID();
    await backfillAriaEntitlements(pool, await prepareEntitlementApply(laterRunId));

    await expect(rollbackAriaEntitlementBackfill(pool, earlierRunId))
      .rejects.toThrow('ARIA_ENTITLEMENT_ROLLBACK_RUN_SUPERSEDED');

    expect(await pool.query(
      'SELECT id FROM entitlements WHERE "sourceSubscriptionId" = $1',
      [subscriptionId],
    )).toMatchObject({ rowCount: 1 });
  });

  it('B3_ROLLBACK_REJECTS_FOREIGN_OR_DRY_RUN_IDENTITY', async () => {
    const foreignApplyId = randomUUID();
    const foreignPrerequisiteId = randomUUID();
    const dryRunId = randomUUID();
    const foreignDigest = foreignApplyId.replaceAll('-', '').repeat(2);
    const dryRunDigest = dryRunId.replaceAll('-', '').repeat(2);
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "completedAt")
       VALUES
        ($1, 'aria-feedback-profile-v1', 'DRY_RUN', '{}'::jsonb, $2,
         'COMPLETED', NOW()),
        ($3, 'aria-entitlements-v1', 'DRY_RUN', '{}'::jsonb, $4,
         'COMPLETED', NOW())`,
      [foreignPrerequisiteId, foreignDigest, dryRunId, dryRunDigest],
    );
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "prerequisiteRunId")
       VALUES ($1, 'aria-feedback-profile-v1', 'APPLY', '{}'::jsonb, $2,
               'RUNNING', $3)`,
      [foreignApplyId, foreignDigest, foreignPrerequisiteId],
    );

    for (const runId of [foreignApplyId, dryRunId]) {
      await expect(rollbackAriaEntitlementBackfill(pool, runId))
        .rejects.toThrow('ARIA_ENTITLEMENT_ROLLBACK_RUN_NOT_COMPLETED');
    }
    await expect(pool.query(
      'SELECT id, status::text FROM aria_data_migration_runs WHERE id = ANY($1::text[]) ORDER BY id',
      [[foreignApplyId, dryRunId]],
    )).resolves.toMatchObject({
      rows: [
        { id: foreignApplyId, status: 'RUNNING' },
        { id: dryRunId, status: 'COMPLETED' },
      ].sort((left, right) => left.id.localeCompare(right.id)),
    });
  });

  it('B3_ROLLBACK_ACCEPTS_PRE_PLANNER_LEGACY_TIMESTAMP_FINGERPRINT', async () => {
    const subscriptionId = randomUUID();
    const runId = randomUUID();
    await pool.query(
      `INSERT INTO subscriptions
        (id, "studentId", "planName", "monthlyPrice", "creditsPerMonth", status,
         "startDate", "endDate", "ariaSubjects", "updatedAt")
       VALUES ($1, $2, 'ARIA', 0, 0, 'ACTIVE', '2026-08-01 00:00:00',
         '2027-07-31 00:00:00', $3, NOW())`,
      [subscriptionId, ids.student, JSON.stringify(['eds-maths-premiere'])],
    );
    await backfillAriaEntitlements(pool, await prepareEntitlementApply(runId));
    const state = await pool.query<{
      id: string;
      status: string;
      startsAt: string;
      endsAt: string | null;
      suspendedAt: string | null;
      revokedAt: string | null;
    }>(
      `SELECT id, status::text,
              to_char("startsAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "startsAt",
              to_char("endsAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "endsAt",
              to_char("suspendedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "suspendedAt",
              to_char("revokedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "revokedAt"
       FROM entitlements WHERE "sourceSubscriptionId" = $1`,
      [subscriptionId],
    );
    const scopes = await pool.query<{ kind: 'GLOBAL' | 'COURSE'; courseKey: string | null }>(
      `SELECT kind::text, "courseKey" FROM aria_entitlement_scopes
       WHERE "entitlementId" = $1 ORDER BY kind::text, "courseKey" NULLS FIRST`,
      [state.rows[0].id],
    );
    const legacyFingerprint = stableLegacyFingerprint({
      status: state.rows[0].status,
      startsAt: state.rows[0].startsAt,
      endsAt: state.rows[0].endsAt,
      suspendedAt: state.rows[0].suspendedAt,
      revokedAt: state.rows[0].revokedAt,
      scopes: scopes.rows,
    });
    // Simulate a row written before the append-only migration was installed.
    // Runtime code cannot disable this trigger; this disposable superuser fixture can.
    await pool.query('ALTER TABLE aria_data_migration_row_audits DISABLE TRIGGER USER');
    try {
      await pool.query(
        `UPDATE aria_data_migration_row_audits
         SET "targetKey" = jsonb_set("targetKey", '{afterFingerprint}', to_jsonb($2::text))
         WHERE "runId" = $1 AND "sourceId" = $3`,
        [runId, legacyFingerprint, subscriptionId],
      );
    } finally {
      await pool.query('ALTER TABLE aria_data_migration_row_audits ENABLE TRIGGER USER');
    }

    await expect(rollbackAriaEntitlementBackfill(pool, runId)).resolves.toEqual({
      entitlementsDeleted: 1,
      entitlementsRestored: expect.any(Number),
    });
  });

  it('B3_COMPLETED_REPLAY_RETURNS_PERSISTED_SEAL_NOT_LIVE_REPLAN', async () => {
    const subscriptionId = randomUUID();
    await pool.query(
      `INSERT INTO subscriptions
        (id, "studentId", "planName", "monthlyPrice", "creditsPerMonth", status,
         "startDate", "endDate", "ariaSubjects", "updatedAt")
       VALUES ($1, $2, 'ARIA', 0, 0, 'ACTIVE', '2026-08-01 00:00:00',
         '2027-07-31 00:00:00', $3, NOW())`,
      [subscriptionId, ids.student, JSON.stringify(['eds-maths-premiere'])],
    );
    const options = await prepareEntitlementApply(randomUUID());
    const first = await backfillAriaEntitlements(pool, options);
    await pool.query(
      'UPDATE subscriptions SET "ariaSubjects" = $2 WHERE id = $1',
      [subscriptionId, JSON.stringify(['ALL'])],
    );

    const replay = await backfillAriaEntitlements(pool, options);

    expect(replay.sourceDigest).toBe(first.sourceDigest);
    expect(replay.sourceSnapshot).toEqual(first.sourceSnapshot);
  });

  it('B3_COMPLETED_REPLAY_REJECTS_MISSING_ROW_AUDITS', async () => {
    const runId = randomUUID();
    const now = new Date('2032-01-01T00:00:00.000Z');
    const dryRun = await backfillAriaEntitlements(pool, {
      runId,
      mode: 'DRY_RUN',
      sourceDigest: '0'.repeat(64),
      now,
    });
    const prerequisiteRunId = await sealEntitlementDryRun(runId, dryRun);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL session_replication_role = 'replica'");
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "prerequisiteRunId", "scannedCount", "deterministicCount", "archivedCount",
           "manualReviewCount", "mutatedCount", "completedAt")
         VALUES ($1, 'aria-entitlements-v1', 'APPLY', $2::jsonb, $3, 'COMPLETED', $4,
                 $5, $6, $7, $8, $6, NOW())`,
        [
          runId,
          JSON.stringify(dryRun.sourceSnapshot),
          dryRun.sourceDigest,
          prerequisiteRunId,
          dryRun.scanned,
          dryRun.deterministic,
          dryRun.archived,
          dryRun.manualReview,
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await expect(backfillAriaEntitlements(pool, {
      runId,
      mode: 'APPLY',
      sourceDigest: dryRun.sourceDigest,
      prerequisiteRunId,
      now,
    })).rejects.toThrow('ARIA_ENTITLEMENT_BACKFILL_REPLAY_AUDIT_INVALID');
  });

  it('B3_COMPLETED_REPLAY_REJECTS_FORGED_ROW_AUDITS', async () => {
    const runId = randomUUID();
    const prerequisiteRunId = randomUUID();
    const sourceId = randomUUID();
    const snapshot = singleEntitlementSnapshot('replay-forged-target');
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "scannedCount", "deterministicCount", "completedAt")
       VALUES ($1, 'aria-entitlements-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', 1, 1, NOW())`,
      [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
    );
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL session_replication_role = 'replica'");
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "prerequisiteRunId", "scannedCount", "deterministicCount", "mutatedCount",
           "completedAt")
         VALUES ($1, 'aria-entitlements-v1', 'APPLY', $2::jsonb, $3, 'COMPLETED', $4,
                 1, 1, 1, NOW())`,
        [runId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
      );
      await client.query(
        `INSERT INTO aria_data_migration_row_audits
          (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
           "targetTable", "targetId", "targetKey", "beforeImage")
         VALUES ($1, $2, 'ARIA_SUBSCRIPTION_ENTITLEMENT', $3, $4,
                 'DETERMINISTIC_BACKFILL', 'entitlements', $5, $6::jsonb, $7::jsonb)`,
        [
          randomUUID(),
          runId,
          sourceId,
          'c'.repeat(64),
          randomUUID(),
          JSON.stringify({
            afterFingerprint: 'd'.repeat(64),
            academicMapConsulted: false,
            created: true,
            generation: 1,
            scopeCount: 1,
          }),
          JSON.stringify({
            ariaSubjects: '["ALL"]',
            endDate: null,
            entitlement: null,
            startDate: '2030-01-01T00:00:00.000Z',
            status: 'ACTIVE',
            subscriptionId: sourceId,
          }),
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await expect(backfillAriaEntitlements(pool, {
      runId,
      mode: 'APPLY',
      sourceDigest: snapshot.sourceDigest,
      prerequisiteRunId,
      now: new Date('2033-01-01T00:00:00.000Z'),
    })).rejects.toThrow('ARIA_ENTITLEMENT_BACKFILL_REPLAY_AUDIT_INVALID');
  });

  it('B3_COMPLETED_REPLAY_REJECTS_FORGED_NONDETERMINISTIC_SOURCE_EVIDENCE', async () => {
    const runId = randomUUID();
    const prerequisiteRunId = randomUUID();
    const sourceId = randomUUID();
    const snapshot = createAriaBackfillSnapshot({
      target: 'entitlements',
      plannerVersion: 1,
      inputs: { entitlementContract: { version: 1 } },
      units: [{ label: 'replay-forged-nondeterministic-source' }],
      report: { scanned: 1, deterministic: 0, archived: 0, manualReview: 1 },
    });
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "scannedCount", "manualReviewCount", "completedAt")
       VALUES ($1, 'aria-entitlements-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', 1, 1, NOW())`,
      [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
    );
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL session_replication_role = 'replica'");
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "prerequisiteRunId", "scannedCount", "manualReviewCount", "completedAt")
         VALUES ($1, 'aria-entitlements-v1', 'APPLY', $2::jsonb, $3, 'COMPLETED', $4,
                 1, 1, NOW())`,
        [runId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
      );
      await client.query(
        `INSERT INTO aria_data_migration_row_audits
          (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
           "targetTable", "targetId", "targetKey", "beforeImage")
         VALUES ($1, $2, 'ARIA_SUBSCRIPTION_ENTITLEMENT', $3, $4,
                 'MANUAL_REVIEW_REQUIRED', NULL, NULL, NULL, '{}'::jsonb)`,
        [randomUUID(), runId, sourceId, '8'.repeat(64)],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await expect(backfillAriaEntitlements(pool, {
      runId,
      mode: 'APPLY',
      sourceDigest: snapshot.sourceDigest,
      prerequisiteRunId,
      now: new Date('2035-01-01T00:00:00.000Z'),
    })).rejects.toThrow('ARIA_ENTITLEMENT_BACKFILL_REPLAY_AUDIT_INVALID');
  });

  it('B3_COMPLETED_REPLAY_REJECTS_INCOMPLETE_ROLLBACK_BEFORE_IMAGE', async () => {
    const runId = randomUUID();
    const prerequisiteRunId = randomUUID();
    const ownedTarget = await createOwnedEntitlementTarget();
    const snapshot = singleEntitlementSnapshot('replay-incomplete-before-image');
    await pool.query(
      `INSERT INTO aria_data_migration_runs
        (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
         "scannedCount", "deterministicCount", "completedAt")
       VALUES ($1, 'aria-entitlements-v1', 'DRY_RUN', $2::jsonb, $3,
               'COMPLETED', 1, 1, NOW())`,
      [prerequisiteRunId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest],
    );
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL session_replication_role = 'replica'");
      await client.query(
        `INSERT INTO aria_data_migration_runs
          (id, "migrationName", mode, "sourceSnapshot", "sourceDigest", status,
           "prerequisiteRunId", "scannedCount", "deterministicCount", "mutatedCount",
           "completedAt")
         VALUES ($1, 'aria-entitlements-v1', 'APPLY', $2::jsonb, $3, 'COMPLETED', $4,
                 1, 1, 1, NOW())`,
        [runId, JSON.stringify(snapshot.sourceSnapshot), snapshot.sourceDigest, prerequisiteRunId],
      );
      await client.query(
        `INSERT INTO aria_data_migration_row_audits
          (id, "runId", "sourceType", "sourceId", "sourceFingerprint", classification,
           "targetTable", "targetId", "targetKey", "beforeImage")
         VALUES ($1, $2, 'ARIA_SUBSCRIPTION_ENTITLEMENT', $3, $4,
                 'DETERMINISTIC_BACKFILL', 'entitlements', $5, $6::jsonb, $7::jsonb)`,
        [
          randomUUID(),
          runId,
          ownedTarget.sourceId,
          '1'.repeat(64),
          ownedTarget.targetId,
          JSON.stringify({
            afterFingerprint: ownedTarget.afterFingerprint,
            academicMapConsulted: false,
            created: false,
            generation: 1,
            scopeCount: 0,
          }),
          JSON.stringify({ subscriptionId: ownedTarget.sourceId }),
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await expect(backfillAriaEntitlements(pool, {
      runId,
      mode: 'APPLY',
      sourceDigest: snapshot.sourceDigest,
      prerequisiteRunId,
      now: new Date('2034-01-01T00:00:00.000Z'),
    })).rejects.toThrow('ARIA_ENTITLEMENT_BACKFILL_REPLAY_AUDIT_INVALID');
    await pool.query('DELETE FROM entitlements WHERE id = $1', [ownedTarget.targetId]);
    await pool.query('DELETE FROM subscriptions WHERE id = $1', [ownedTarget.sourceId]);
  });

  it('B3_CONCURRENT_SCOPE_CHANGE_CANNOT_ESCAPE_FROZEN_PLAN', async () => {
    const subscriptionId = randomUUID();
    await pool.query(
      `INSERT INTO subscriptions
        (id, "studentId", "planName", "monthlyPrice", "creditsPerMonth", status,
         "startDate", "endDate", "ariaSubjects", "updatedAt")
       VALUES ($1, $2, 'ARIA', 0, 0, 'ACTIVE', '2026-08-01 00:00:00',
         '2027-07-31 00:00:00', $3, NOW())`,
      [subscriptionId, ids.student, JSON.stringify(['eds-maths-premiere'])],
    );
    await backfillAriaEntitlements(
      pool,
      await prepareEntitlementApply(randomUUID()),
    );
    const scope = await pool.query<{ id: string }>(
      `SELECT scope.id FROM aria_entitlement_scopes scope
       JOIN entitlements entitlement ON entitlement.id = scope."entitlementId"
       WHERE entitlement."sourceSubscriptionId" = $1`,
      [subscriptionId],
    );
    await pool.query(
      `CREATE FUNCTION aria_test_pause_entitlement_update() RETURNS trigger
       LANGUAGE plpgsql AS $function$
       BEGIN
         PERFORM pg_advisory_xact_lock(8675309);
         RETURN NEW;
       END
       $function$`,
    );
    await pool.query(
      `CREATE TRIGGER aria_test_pause_entitlement_update
       BEFORE UPDATE ON entitlements FOR EACH ROW
       EXECUTE FUNCTION aria_test_pause_entitlement_update()`,
    );
    const racePool = new Pool({ connectionString: databaseUrl, max: 3 });
    const racingOptions = await prepareEntitlementApply(randomUUID());
    const blocker = await racePool.connect();
    const concurrent = await racePool.connect();
    let barrierReleased = false;
    let backfill: ReturnType<typeof backfillAriaEntitlements> | undefined;
    let scopeUpdate: Promise<QueryResult> | undefined;
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT pg_advisory_xact_lock(8675309)');
      backfill = backfillAriaEntitlements(pool, racingOptions);
      const backfillReachedBarrier = await waitForDatabaseCondition(async () => {
        const waiting = await blocker.query(
          `SELECT 1 FROM pg_stat_activity
           WHERE pid <> pg_backend_pid() AND wait_event = 'advisory'`,
        );
        return (waiting.rowCount ?? 0) > 0;
      });
      if (!backfillReachedBarrier) {
        const outcome = await Promise.race([
          backfill.then(() => 'resolved', (error: Error) => `rejected:${error.message}`),
          new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 20)),
        ]);
        const activity = await blocker.query<{
          state: string;
          waitEventType: string | null;
          waitEvent: string | null;
          query: string;
        }>(
          `SELECT state, "wait_event_type" AS "waitEventType", wait_event AS "waitEvent",
                  left(query, 120) AS query
           FROM pg_stat_activity WHERE datname = current_database() ORDER BY pid`,
        );
        throw new Error(
          `ARIA_TEST_BACKFILL_BARRIER_NOT_REACHED:${outcome}:${JSON.stringify(activity.rows)}`,
        );
      }

      scopeUpdate = concurrent.query(
        `UPDATE aria_entitlement_scopes
         SET "courseKey" = 'eds-physique-chimie-premiere', "updatedAt" = NOW()
         WHERE id = $1`,
        [scope.rows[0].id],
      );
      expect(await waitForDatabaseCondition(async () => {
        const waiting = await blocker.query(
          `SELECT 1 FROM pg_stat_activity
           WHERE pid <> pg_backend_pid() AND "wait_event_type" = 'Lock'
             AND wait_event <> 'advisory'`,
        );
        return (waiting.rowCount ?? 0) > 0;
      })).toBe(true);

      await blocker.query('COMMIT');
      barrierReleased = true;
      const runningBackfill = backfill;
      const runningScopeUpdate = scopeUpdate;
      if (!runningBackfill || !runningScopeUpdate) {
        throw new Error('ARIA_TEST_ENTITLEMENT_RACE_NOT_STARTED');
      }
      const [, updateResult] = await Promise.all([runningBackfill, runningScopeUpdate]);
      expect(updateResult.rowCount ?? 0).toBe(0);
    } finally {
      if (!barrierReleased) await blocker.query('ROLLBACK');
      await Promise.allSettled([backfill, scopeUpdate].filter(Boolean));
      blocker.release();
      concurrent.release();
      await racePool.end();
      await pool.query('DROP TRIGGER IF EXISTS aria_test_pause_entitlement_update ON entitlements');
      await pool.query('DROP FUNCTION IF EXISTS aria_test_pause_entitlement_update()');
    }
  });
});
