/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  backfillAriaEntitlements,
  rollbackAriaEntitlementBackfill,
} from '@/scripts/aria/backfill-entitlements';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

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
      [randomUUID(), ids.student, randomUUID()],
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

  it('D018 ARIA-B-R026 is repeatable and concurrency-safe with status on Entitlement and strict child scopes', async () => {
    const options = {
      runId: randomUUID(),
      mode: 'APPLY' as const,
      sourceDigest: '1'.repeat(64),
      now: new Date('2026-08-30T12:00:00.000Z'),
    };
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
    await backfillAriaEntitlements(pool, {
      runId,
      mode: 'APPLY',
      sourceDigest: '2'.repeat(64),
      now: new Date('2026-08-30T12:00:00.000Z'),
    });
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
    await backfillAriaEntitlements(pool, {
      runId,
      mode: 'APPLY',
      sourceDigest: '3'.repeat(64),
      now: new Date('2026-08-30T12:00:00.000Z'),
    });
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
    await backfillAriaEntitlements(pool, {
      runId,
      mode: 'APPLY',
      sourceDigest: '4'.repeat(64),
      now: new Date('2026-08-30T12:00:00.000Z'),
    });
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

  it('ENTITLEMENT_REAPPLY_AFTER_ROLLBACK_REBUILDS_CANONICAL_AUDIT_IDENTITY', async () => {
    const subscriptionId = randomUUID();
    const sourceDigest = '5'.repeat(64);
    const runId = randomUUID();
    await pool.query(
      `INSERT INTO subscriptions
        (id, "studentId", "planName", "monthlyPrice", "creditsPerMonth", status,
         "startDate", "endDate", "ariaSubjects", "updatedAt")
       VALUES ($1, $2, 'ARIA', 0, 0, 'ACTIVE', NOW() - INTERVAL '2 days',
         NOW() + INTERVAL '10 days', $3, NOW())`,
      [subscriptionId, ids.student, JSON.stringify(['eds-maths-premiere'])],
    );
    await backfillAriaEntitlements(pool, {
      runId, mode: 'APPLY', sourceDigest, now: new Date('2026-08-30T12:00:00.000Z'),
    });
    await rollbackAriaEntitlementBackfill(pool, runId);

    await expect(backfillAriaEntitlements(pool, {
      runId: randomUUID(), mode: 'APPLY', sourceDigest,
      now: new Date('2026-08-30T12:00:00.000Z'),
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
    await backfillAriaEntitlements(pool, {
      runId: earlierRunId, mode: 'APPLY', sourceDigest: '6'.repeat(64),
      now: new Date('2026-08-30T12:00:00.000Z'),
    });
    await backfillAriaEntitlements(pool, {
      runId: randomUUID(), mode: 'APPLY', sourceDigest: '7'.repeat(64),
      now: new Date('2026-08-30T12:00:00.000Z'),
    });

    await expect(rollbackAriaEntitlementBackfill(pool, earlierRunId))
      .rejects.toThrow('ARIA_ENTITLEMENT_ROLLBACK_RUN_SUPERSEDED');

    expect(await pool.query(
      'SELECT id FROM entitlements WHERE "sourceSubscriptionId" = $1',
      [subscriptionId],
    )).toMatchObject({ rowCount: 1 });
  });
});
