import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';
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
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB connection timeout')), 3000)
    );
    await Promise.race([testPrisma.$queryRaw`SELECT 1`, timeout]);
    return true;
  } catch {
    return false;
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
 * competes with the real test for a connection slot. `$disconnect()` in
 * `finally` closes this client's pool immediately, which drops that
 * in-flight probe query at the transport level — Prisma has no query-level
 * cancellation, so this is the closest available guarantee.
 */
export async function assertTestDbAvailable(): Promise<void> {
  const probe = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB connection timeout')), 3000)
    );
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
    await probe.$disconnect().catch(() => { /* best-effort */ });
  }
}

// Test data setup utilities
export async function setupTestDatabase() {
  try {
    // Get all table names dynamically
    const tables = await testPrisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename != '_prisma_migrations'
    `;

    if (tables.length === 0) return;

    // Disable triggers for clean TRUNCATE
    await testPrisma.$executeRawUnsafe('SET session_replication_role = replica;');

    try {
      // TRUNCATE all tables with RESTART IDENTITY CASCADE
      for (const { tablename } of tables) {
        try {
          await testPrisma.$executeRawUnsafe(
            `TRUNCATE TABLE "${tablename}" RESTART IDENTITY CASCADE;`
          );
        } catch {
          // Table might not exist or have special constraints
        }
      }
    } finally {
      // Re-enable triggers
      await testPrisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
  } catch (error) {
    console.warn('⚠️  Could not truncate tables, falling back to deleteMany:', error);
    // Fallback to deleteMany if TRUNCATE fails
    try { await testPrisma.sessionReminder.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.sessionNotification.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.creditTransaction.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.sessionBooking.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.session.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.ariaMessage.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.ariaConversation.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.studentBadge.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.badge.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.studentReport.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.message.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.payment.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.coachAvailability.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.student.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.subscription.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.parentProfile.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.coachProfile.deleteMany(); } catch { /* ignore */ }
    try { await testPrisma.user.deleteMany(); } catch { /* ignore */ }
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
