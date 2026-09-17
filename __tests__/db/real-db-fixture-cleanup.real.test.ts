/** @jest-environment node */

/**
 * Proves the canonical fixture disposal mechanism on a real PostgreSQL schema.
 *
 * Every case seeds TWO independent fixtures — a target and a control — cleans
 * only the target, and asserts the control survived untouched. A teardown
 * helper that deletes too much is far more damaging than one that deletes too
 * little: it corrupts whatever else is running against the same disposable
 * database, and does so silently.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import {
  cleanupDisposableTestFixture,
  planFixtureDeletion,
  resetSchemaGraphCache,
} from '../helpers/real-db-fixture-cleanup';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

interface SeededAccount {
  parentUser: string;
  parent: string;
  studentUser: string;
  student: string;
  entitlement: string;
  enrollment: string;
}

describe('real-db fixture cleanup on PostgreSQL', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: databaseUrl });
  });

  afterAll(async () => {
    await pool.end();
  });

  async function seedAccount(courseKey = 'eds-maths-premiere'): Promise<SeededAccount> {
    const ids: SeededAccount = {
      parentUser: randomUUID(),
      parent: randomUUID(),
      studentUser: randomUUID(),
      student: randomUUID(),
      entitlement: randomUUID(),
      enrollment: randomUUID(),
    };
    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
       ($1, $2, 'PARENT', NOW()), ($3, $4, 'ELEVE', NOW())`,
      [ids.parentUser, `p-${ids.parentUser}@invalid.test`, ids.studentUser, `s-${ids.studentUser}@invalid.test`],
    );
    await pool.query('INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)', [ids.parent, ids.parentUser]);
    await pool.query(
      `INSERT INTO students (id, "parentId", "userId", "gradeLevel", "academicTrack", "updatedAt")
       VALUES ($1, $2, $3, 'PREMIERE', 'EDS_GENERALE', NOW())`,
      [ids.student, ids.parent, ids.studentUser],
    );
    await pool.query(
      `INSERT INTO student_academic_enrollments
       (id, "studentId", "courseKey", kind, source, "curriculumVersion", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW())`,
      [ids.enrollment, ids.student, courseKey],
    );
    await pool.query(
      `INSERT INTO entitlements
       (id, "userId", "productCode", label, status, "startsAt", "endsAt", "createdAt", "updatedAt")
       VALUES ($1, $2, 'ARIA_ACCESS', 'ARIA', 'ACTIVE', NOW() - INTERVAL '1 day',
               NOW() + INTERVAL '30 days', NOW(), NOW())`,
      [ids.entitlement, ids.studentUser],
    );
    await pool.query(
      `INSERT INTO aria_entitlement_scopes (id, "entitlementId", kind, "courseKey", "createdAt", "updatedAt")
       VALUES ($1, $2, 'COURSE', $3, NOW(), NOW())`,
      [randomUUID(), ids.entitlement, courseKey],
    );
    return ids;
  }

  const countById = async (table: string, id: string): Promise<number> => {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM "${table}" WHERE id = $1`, [id]);
    return rows[0].n as number;
  };

  it('removes the whole owned graph of one account and leaves an independent account intact', async () => {
    const target = await seedAccount();
    const control = await seedAccount();

    const report = await cleanupDisposableTestFixture(pool, {
      userIds: [target.parentUser, target.studentUser],
    });

    // The target is gone, root and every owned descendant.
    expect(await countById('users', target.studentUser)).toBe(0);
    expect(await countById('users', target.parentUser)).toBe(0);
    expect(await countById('parent_profiles', target.parent)).toBe(0);
    expect(await countById('students', target.student)).toBe(0);
    expect(await countById('entitlements', target.entitlement)).toBe(0);
    expect(await countById('student_academic_enrollments', target.enrollment)).toBe(0);

    // The control fixture is untouched — this is the assertion that matters.
    expect(await countById('users', control.studentUser)).toBe(1);
    expect(await countById('users', control.parentUser)).toBe(1);
    expect(await countById('parent_profiles', control.parent)).toBe(1);
    expect(await countById('students', control.student)).toBe(1);
    expect(await countById('entitlements', control.entitlement)).toBe(1);
    expect(await countById('student_academic_enrollments', control.enrollment)).toBe(1);

    expect(report.deleted.users).toBe(2);
    expect(report.deleted.students).toBe(1);

    await cleanupDisposableTestFixture(pool, { userIds: [control.parentUser, control.studentUser] });
  });

  it('cleans a student root without touching the parent account above it', async () => {
    const fixture = await seedAccount();

    await cleanupDisposableTestFixture(pool, { studentIds: [fixture.student] });

    expect(await countById('students', fixture.student)).toBe(0);
    expect(await countById('student_academic_enrollments', fixture.enrollment)).toBe(0);
    // Ownership only ever flows downward: the parent above the student stays.
    expect(await countById('parent_profiles', fixture.parent)).toBe(1);
    expect(await countById('users', fixture.parentUser)).toBe(1);
    expect(await countById('users', fixture.studentUser)).toBe(1);

    await cleanupDisposableTestFixture(pool, { userIds: [fixture.parentUser, fixture.studentUser] });
  });

  it('leaves shared reference data alone', async () => {
    const before = await pool.query('SELECT COUNT(*)::int AS n FROM "_prisma_migrations"');
    const fixture = await seedAccount();
    await cleanupDisposableTestFixture(pool, { userIds: [fixture.parentUser, fixture.studentUser] });
    const after = await pool.query('SELECT COUNT(*)::int AS n FROM "_prisma_migrations"');
    // No edge leads from a fixture root to migration metadata, so it cannot be in scope.
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('accepts several roots in one call and is idempotent when re-run', async () => {
    const first = await seedAccount();
    const second = await seedAccount();

    const report = await cleanupDisposableTestFixture(pool, {
      userIds: [first.parentUser, first.studentUser, second.parentUser, second.studentUser],
    });
    expect(report.deleted.users).toBe(4);

    // Running it again removes nothing and must not throw.
    const again = await cleanupDisposableTestFixture(pool, {
      userIds: [first.parentUser, first.studentUser, second.parentUser, second.studentUser],
    });
    expect(again.deleted.users ?? 0).toBe(0);
  });

  it('works through a Prisma client, which most real-DB suites hold', async () => {
    // 41 of the 52 migrated teardown sites pass a PrismaClient rather than a
    // pg Pool, so the Prisma branch carries most of the traffic and cannot be
    // left to the pg tests to imply.
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      const target = await seedAccount();
      const control = await seedAccount();

      const report = await cleanupDisposableTestFixture(prisma, {
        userIds: [target.parentUser, target.studentUser],
      });

      expect(report.deleted.users).toBe(2);
      expect(await countById('users', target.studentUser)).toBe(0);
      expect(await countById('entitlements', target.entitlement)).toBe(0);
      expect(await countById('students', target.student)).toBe(0);

      expect(await countById('users', control.studentUser)).toBe(1);
      expect(await countById('students', control.student)).toBe(1);

      await cleanupDisposableTestFixture(prisma, {
        userIds: [control.parentUser, control.studentUser],
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('refuses an empty scope rather than deleting broadly', async () => {
    await expect(cleanupDisposableTestFixture(pool, {})).rejects.toThrow(
      /REAL_DB_FIXTURE_CLEANUP_EMPTY_SCOPE/,
    );
  });

  it('derives an order in which every owning edge deletes the child first', async () => {
    const fixture = await seedAccount();
    const report = await cleanupDisposableTestFixture(pool, {
      userIds: [fixture.parentUser, fixture.studentUser],
    });

    const position = new Map(report.deletionOrder.map((table, index) => [table, index]));
    // Spot-check the three relationships that broke the CI lanes.
    expect(position.get('entitlements')!).toBeLessThan(position.get('users')!);
    expect(position.get('students')!).toBeLessThan(position.get('parent_profiles')!);
    expect(position.get('student_academic_enrollments')!).toBeLessThan(position.get('students')!);
  });

  it('breaks dependency cycles only at nullable edges', async () => {
    const fixture = await seedAccount();
    const report = await cleanupDisposableTestFixture(pool, {
      userIds: [fixture.parentUser, fixture.studentUser],
    });
    // users.mergedIntoUserId is RESTRICT and self-referential; it is nullable,
    // so the plan clears it instead of disabling the constraint.
    expect(report.clearedCycleEdges).toContain('users.mergedIntoUserId');
  });

  it('fails loudly when a table is owned only through a composite foreign key', () => {
    const graph = {
      edges: [
        { conname: 'child_root', child: 'child', parent: 'root', childColumn: 'rootId', action: 'CASCADE' as const, nullable: false },
      ],
      compositeEdges: [
        { conname: 'orphan_child', child: 'orphan', parent: 'child', action: 'RESTRICT' as const, nullable: false },
      ],
      primaryKey: { root: 'id', child: 'id', orphan: 'id' },
    };
    expect(() => planFixtureDeletion(graph, ['root'])).toThrow(
      /REAL_DB_FIXTURE_CLEANUP_COMPOSITE_ONLY_DEPENDENCY[\s\S]*orphan/,
    );
  });

  it('fails loudly when a cycle has no nullable edge to break', () => {
    const graph = {
      edges: [
        { conname: 'a_b', child: 'a', parent: 'b', childColumn: 'bId', action: 'RESTRICT' as const, nullable: false },
        { conname: 'b_a', child: 'b', parent: 'a', childColumn: 'aId', action: 'RESTRICT' as const, nullable: false },
      ],
      compositeEdges: [],
      primaryKey: { a: 'id', b: 'id' },
    };
    expect(() => planFixtureDeletion(graph, ['b'])).toThrow(
      /REAL_DB_FIXTURE_CLEANUP_UNBREAKABLE_CYCLE/,
    );
  });

  it('absorbs a newly introduced RESTRICT dependency without being taught about it', async () => {
    // The schema-evolution contract. A new migration means a new test process,
    // so the honest reproduction is: the blocking relation already exists when
    // the graph is first read, and nothing in this helper knows its name.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "synthetic_restrict_probe" (
        id text PRIMARY KEY,
        "studentId" text NOT NULL REFERENCES "students"(id) ON DELETE RESTRICT
      )`);
    resetSchemaGraphCache(pool);
    try {
      const fixture = await seedAccount();
      const probeId = randomUUID();
      await pool.query('INSERT INTO "synthetic_restrict_probe" (id, "studentId") VALUES ($1, $2)', [
        probeId,
        fixture.student,
      ]);

      const report = await cleanupDisposableTestFixture(pool, {
        userIds: [fixture.parentUser, fixture.studentUser],
      });

      expect(await countById('synthetic_restrict_probe', probeId)).toBe(0);
      expect(await countById('students', fixture.student)).toBe(0);
      expect(report.deletionOrder).toContain('synthetic_restrict_probe');
    } finally {
      await pool.query('DROP TABLE IF EXISTS "synthetic_restrict_probe"');
      resetSchemaGraphCache(pool);
    }
  });

  it('reports schema drift clearly instead of surfacing a bare foreign-key error', async () => {
    // The other half of the contract: if the graph IS stale, the failure must
    // name the cause rather than read as a mysterious teardown P2003.
    // Warm the graph cache on a throwaway fixture, so the one under test survives.
    const warmup = await seedAccount();
    await cleanupDisposableTestFixture(pool, { userIds: [warmup.parentUser, warmup.studentUser] });
    const fixture = await seedAccount();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "synthetic_stale_probe" (
        id text PRIMARY KEY,
        "studentId" text NOT NULL REFERENCES "students"(id) ON DELETE RESTRICT
      )`);
    try {
      await pool.query('INSERT INTO "synthetic_stale_probe" (id, "studentId") VALUES ($1, $2)', [
        randomUUID(),
        fixture.student,
      ]);
      await expect(
        cleanupDisposableTestFixture(pool, { userIds: [fixture.studentUser] }),
      ).rejects.toThrow(/REAL_DB_FIXTURE_CLEANUP_ORDER_INCOMPLETE[\s\S]*synthetic_stale_probe/);
    } finally {
      await pool.query('DROP TABLE IF EXISTS "synthetic_stale_probe"');
      resetSchemaGraphCache(pool);
      await cleanupDisposableTestFixture(pool, { userIds: [fixture.studentUser] });
    }
  });
});
