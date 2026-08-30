/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { backfillAriaEntitlements } from '@/scripts/aria/backfill-entitlements';

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
       VALUES ($1, $2, 'eds-maths-premiere', 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW())`,
      [randomUUID(), ids.student],
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
         NOW() + INTERVAL '20 days', $14, NOW())`,
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
      ],
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [ids.parentUser]);
    await pool.end();
  });

  it('is repeatable and concurrency-safe with status on Entitlement and strict child scopes', async () => {
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
});
