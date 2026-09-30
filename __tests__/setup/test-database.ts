import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import { assertDisposablePostgresUrl } from '../helpers/disposable-postgres';

// Preserve CI-provided env vars before loading .env.test defaults
const ciDatabaseUrl = process.env.DATABASE_URL;
const ciTestDatabaseUrl = process.env.TEST_DATABASE_URL;

// Load test env vars (override: true so TEST_DATABASE_URL from .env.test takes precedence)
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

// Restore CI env vars if they were set (they take absolute precedence)
if (ciDatabaseUrl) process.env.DATABASE_URL = ciDatabaseUrl;
if (ciTestDatabaseUrl) process.env.TEST_DATABASE_URL = ciTestDatabaseUrl;

// Keep both variables aligned to avoid implicit Prisma connections using DATABASE_URL
if (!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL) {
  process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
}
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nexus_disposable_test?schema=public';

assertDisposablePostgresUrl(testDbUrl);

// Create a test database instance AFTER loading env vars
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl
    }
  }
});

/**
 * Reset the database schema for a completely clean test run.
 * This is called once before all integration tests to ensure no constraint violations.
 * Note: The CI already runs migrations, so this is optional.
 */
export async function resetTestDatabase() {
  try {
    // Drop and recreate schema
    await testPrisma.$executeRaw`DROP SCHEMA IF EXISTS public CASCADE`;
    await testPrisma.$executeRaw`CREATE SCHEMA public`;
    console.log('✅ Database schema reset for clean test run');
  } catch (error) {
    console.warn('⚠️  Could not reset database schema:', error);
  }
}

/**
 * Check if the test database is reachable.
 * Returns true if connected, false otherwise.
 * Includes a 3-second timeout to prevent hanging.
 *
 * Do not use this to decide whether to skip a mandatory real-database suite:
 * every caller in the `db-core` lane is given a database by the CI workflow
 * itself, so "unreachable" there is never a legitimate reason to no-op —
 * it means the environment is broken and the suite must fail loudly. Use
 * `assertTestDbAvailable` for that. This function remains for callers that
 * have an actual optional/local-dev skip use case.
 */
export async function canConnectToTestDb(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('DB connection timeout')), 3000);
    });
    await Promise.race([testPrisma.$queryRaw`SELECT 1`, timeout]);
    return true;
  } catch {
    return false;
  } finally {
    // Clear on the winning path too — otherwise a fast query still leaves
    // the losing timer armed, firing a reject() nothing awaits 3s later.
    clearTimeout(timer);
  }
}

/**
 * Fail loudly if the test database is not reachable.
 *
 * Every suite in the mandatory `db-core` CI lane is handed a live disposable
 * Postgres by the workflow before it runs (see `.github/workflows/ci.yml`,
 * job "Real DB Integration"). An unreachable database there is an
 * environment failure, not a reason to skip: the previous pattern
 * (`canConnectToTestDb` → `false` → `console.warn` → `return`) let every
 * `it()` in the file no-op and Jest reported the suite as fully PASSED —
 * demonstrated: with the database stopped, the unfixed
 * `credit-debit-idempotency.test.ts` exits 0 reporting "10 passed, 10 total"
 * in 0.6s while doing nothing. Throwing here makes Jest fail every test in
 * the `describe` block instead.
 *
 * Uses a dedicated, short-lived client for the probe rather than the shared
 * `testPrisma`: `Promise.race` does not cancel the losing promise, so a
 * probe against the shared client can leave a query in flight that later
 * competes with the real test for a connection slot. Three distinct,
 * separately-scoped guarantees here, not one:
 * - the 3s timer is explicitly cleared in `finally`, on every path
 *   (demonstrated by a dedicated test — a fast, successful probe used to
 *   leave it armed to fire, unawaited, 3s after this function returned);
 * - `$disconnect()` in `finally` closes *this* client's own pool, so it
 *   cannot outlive the probe and hold a connection slot open indefinitely;
 * - whether that disconnect also cancels an in-flight query at the
 *   transport level, rather than merely closing the pool around it, is
 *   Prisma-internal behavior this code does not depend on and has not
 *   verified — Prisma exposes no query-cancellation API, so no claim is
 *   made about the query itself being aborted, only about the resources
 *   this function itself is responsible for releasing.
 *
 * `url` defaults to the lane's real database and only exists so this
 * function's own failure behavior can be exercised in a test against a
 * genuinely unreachable target, without touching the shared disposable
 * Postgres every other suite in the job depends on.
 */
export async function assertTestDbAvailable(url: string = testDbUrl): Promise<void> {
  const started = performance.now();
  const probe = new PrismaClient({ datasources: { db: { url } } });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('DB connection timeout')), 3000);
    });
    await Promise.race([probe.$queryRaw`SELECT 1`, timeout]);
  } catch (cause) {
    throw new Error(
      'DB_UNAVAILABLE_IN_MANDATORY_LANE: the disposable test database that ' +
      'this CI job provisions was not reachable within 3s. This lane never ' +
      'skips on a missing database — treat this as an environment failure ' +
      'and fix the database/connection, not the test.',
      { cause }
    );
  } finally {
    // Clear on the winning (fast query) path too, or the losing timer stays
    // armed and rejects 3s later with nothing left awaiting it.
    clearTimeout(timer);
    await probe.$disconnect().catch(() => { /* best-effort */ });
    console.info('DB_CORE_CONNECTION_METRIC', JSON.stringify({ durationMs: Math.round(performance.now() - started) }));
  }
}

// Test data setup utilities
export const DB_CORE_INVENTORY_STATEMENT_TIMEOUT_MS = 1000;
export const DB_CORE_TRUNCATE_STATEMENT_TIMEOUT_MS = 15000;

/** Prisma's omitted schema parameter means PostgreSQL's default public schema. */
export function assertDbCorePublicSchema(target: URL): void {
  const schema = target.searchParams.get('schema');
  if (schema !== null && schema !== 'public') {
    throw new Error('DB_CORE_CLEANUP_REQUIRES_PUBLIC_SCHEMA');
  }
}

export async function setupTestDatabase(): Promise<{
  tables: number;
  cleanupStatements: number;
  inventoryMs: number;
  cleanupMs: number;
  totalMs: number;
}> {
  // Recheck on every invocation, not only at module import: a test or operator
  // can change the marker between two calls. Never execute SQL on an unproved target.
  const target = assertDisposablePostgresUrl(testDbUrl);
  assertDbCorePublicSchema(target);

  const started = performance.now();
  let tables = 0;
  let inventoryMs = 0;
  let cleanupMs = 0;
  let cleanupStatements = 0;
  let succeeded = false;
  try {
    await testPrisma.$transaction(async (tx) => {
      // PostgreSQL cancels the SQL itself on a lock/query timeout. A JS timer
      // alone would leave an in-flight destructive statement behind.
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '1500ms'");
      // Four catalog reads are each bounded at 1 s, then the one TRUNCATE at
      // 15 s. Under accumulated I/O the 7 s limit cancelled two otherwise
      // healthy db-core cleanups. Even with Prisma's 3 s maxWait, PostgreSQL
      // cancels SQL before the 30 s client limit and the 35 s caller hook.
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${DB_CORE_INVENTORY_STATEMENT_TIMEOUT_MS}ms'`);

      const inventoryStart = performance.now();
      const current = await tx.$queryRaw<Array<{ database_name: string }>>`SELECT current_database() AS database_name`;
      if (current[0]?.database_name !== decodeURIComponent(target.pathname.slice(1))) {
        throw new Error('DB_CORE_CLEANUP_DATABASE_IDENTITY_MISMATCH');
      }
      const relations = await tx.$queryRaw<Array<{ schemaname: string; tablename: string }>>`
        SELECT n.nspname AS schemaname, c.relname AS tablename
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND c.relname <> '_prisma_migrations'
        ORDER BY n.nspname, c.relname
      `;
      tables = relations.length;

      // A parent TRUNCATE can traverse partitions/inheritance into another
      // schema. No such object is in the current migration set; fail closed
      // if one is introduced instead of widening the cleanup implicitly.
      const inheritance = await tx.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) FROM pg_catalog.pg_inherits i
        JOIN pg_catalog.pg_class child ON child.oid = i.inhrelid
        JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid = child.relnamespace
        JOIN pg_catalog.pg_class parent ON parent.oid = i.inhparent
        JOIN pg_catalog.pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
        WHERE child_ns.nspname = 'public' OR parent_ns.nspname = 'public'
      `;
      if (inheritance[0].count !== BigInt(0)) {
        throw new Error('DB_CORE_CLEANUP_PARTITION_OR_INHERITANCE_REQUIRES_REVIEW');
      }
      const truncateTriggers = await tx.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) FROM pg_catalog.pg_trigger t
        JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname <> '_prisma_migrations'
          AND NOT t.tgisinternal
          AND (t.tgtype & 32) <> 0
      `;
      if (truncateTriggers[0].count !== BigInt(0)) {
        throw new Error('DB_CORE_CLEANUP_ON_TRUNCATE_TRIGGER_REQUIRES_REVIEW');
      }
      inventoryMs = performance.now() - inventoryStart;
      if (tables === 0) return;

      const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
      const qualified = relations.map(({ schemaname, tablename }) => `${quote(schemaname)}.${quote(tablename)}`);
      const cleanupStart = performance.now();
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${DB_CORE_TRUNCATE_STATEMENT_TIMEOUT_MS}ms'`);
      cleanupStatements = 1;
      try {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${qualified.join(', ')} RESTART IDENTITY RESTRICT`);
      } finally {
        cleanupMs = performance.now() - cleanupStart;
      }
    }, { maxWait: 3000, timeout: 30000 });
    succeeded = true;
    return {
      tables,
      cleanupStatements,
      inventoryMs: Math.round(inventoryMs),
      cleanupMs: Math.round(cleanupMs),
      totalMs: Math.round(performance.now() - started),
    };
  } finally {
    console.info('DB_CORE_CLEANUP_METRIC', JSON.stringify({
      success: succeeded,
      tables,
      cleanupStatements,
      inventoryMs: Math.round(inventoryMs),
      cleanupMs: Math.round(cleanupMs),
      totalMs: Math.round(performance.now() - started),
    }));
  }
}

export async function teardownTestDatabase() {
  await setupTestDatabase(); // Clean up after tests
  await testPrisma.$disconnect();
}

// Test data factories
export const createTestParent = async (overrides: any = {}) => {
  // Generate unique email using UUID for absolute uniqueness
  const uniqueEmail = overrides.email || `test.parent.${randomUUID()}@nexus-test.com`;

  const parentUser = await testPrisma.user.create({
    data: {
      password: 'hashed-password',
      role: 'PARENT',
      firstName: 'Jean',
      lastName: 'Dupont',
      phone: '0123456789',
      ...overrides,
      email: uniqueEmail,  // Ensure email isn't overridden
    }
  });

  const parentProfile = await testPrisma.parentProfile.create({
    data: {
      userId: parentUser.id,
      city: 'Tunis',
      country: 'Tunisie',
      ...overrides.profile
    }
  });

  return { parentUser, parentProfile };
};

export const createTestStudent = async (parentId: string, overrides: any = {}) => {
  const studentUser = await testPrisma.user.create({
    data: {
      email: `test.student.${randomUUID()}@nexus-test.com`,
      role: 'ELEVE',
      firstName: 'Marie',
      lastName: 'Dupont',
      ...overrides.user
    }
  });

  const student = await testPrisma.student.create({
    data: {
      parentId,
      userId: studentUser.id,
      grade: 'Terminale',
      gradeLevel: 'TERMINALE',
      school: 'Lycée Test',
      ...overrides.student
    }
  });

  return { studentUser, student };
};

export const createTestCoach = async (overrides: any = {}) => {
  const uuid = randomUUID();
  const coachUser = await testPrisma.user.create({
    data: {
      email: `test.coach.${uuid}@nexus-test.com`,
      role: 'COACH',
      firstName: 'Pierre',
      lastName: 'Martin',
      ...overrides.user
    }
  });

  const coachProfile = await testPrisma.coachProfile.create({
    data: {
      userId: coachUser.id,
      pseudonym: `Prof_${uuid.substring(0, 12)}`,
      subjects: JSON.stringify(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE']),
      availableOnline: true,
      ...overrides.profile
    }
  });

  return { coachUser, coachProfile };
};

export const createTestCoachAvailability = async (coachId: string, overrides: any = {}) => {
  return await testPrisma.coachAvailability.create({
    data: {
      coachId,
      dayOfWeek: 3, // Wednesday
      isRecurring: true,
      isAvailable: true,
      startTime: '08:00',
      endTime: '20:00',
      ...overrides
    }
  });
};

export const createTestSessionBooking = async (overrides: Partial<any> = {}) => {
  // Create coach if not provided
  let coach;
  if (!overrides.coachId) {
    const coachData = await createTestCoach();
    coach = coachData.coachProfile;
  }

  // Create student if not provided
  let studentData;
  if (!overrides.studentId) {
    const { parentProfile } = await createTestParent();
    studentData = await createTestStudent(parentProfile.id);
  }

  const coachId = overrides.coachId || coach?.userId;
  const studentId = overrides.studentId || studentData?.studentUser.id;

  // Generate a unique future date to avoid exclusion constraint collisions
  const uniqueOffset = Math.floor(Math.random() * 365) + 1;
  const uniqueDate = new Date();
  uniqueDate.setDate(uniqueDate.getDate() + uniqueOffset);
  uniqueDate.setHours(0, 0, 0, 0);
  // Generate a unique start hour (8-18) to further reduce collision risk
  const startHour = 8 + Math.floor(Math.random() * 11);
  const startTime = `${String(startHour).padStart(2, '0')}:00`;
  const endTime = `${String(startHour + 1).padStart(2, '0')}:00`;

  return await testPrisma.sessionBooking.create({
    data: {
      coachId: coachId!,
      studentId: studentId!,
      subject: 'MATHEMATIQUES',
      title: 'Test session',
      scheduledDate: uniqueDate,
      startTime,
      endTime,
      duration: 60,
      creditsUsed: 1,
      status: 'SCHEDULED',
      type: 'INDIVIDUAL',
      modality: 'ONLINE',
      ...overrides
    }
  });
};

export const createTestCreditTransaction = async (studentId: string, overrides: any = {}) => {
  return await testPrisma.creditTransaction.create({
    data: {
      studentId,
      type: 'PURCHASE',
      amount: 10,
      description: 'Test credit purchase',
      ...overrides
    }
  });
};

export const createTestSubscription = async (studentId: string, overrides: any = {}) => {
  return await testPrisma.subscription.create({
    data: {
      studentId,
      planName: 'PREMIUM',
      status: 'ACTIVE',
      creditsPerMonth: 20,
      monthlyPrice: 199.99,
      startDate: new Date(),
      ...overrides
    }
  });
};

export const addCreditsToStudent = async (studentId: string, amount: number) => {
  return await testPrisma.creditTransaction.create({
    data: {
      studentId,
      type: 'PURCHASE',
      amount,
      description: `Test credit allocation: ${amount} credits`
    }
  });
};
