import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';

// Preserve CI-provided env vars before loading .env.test defaults
const ciDatabaseUrl = process.env.DATABASE_URL;
const ciTestDatabaseUrl = process.env.TEST_DATABASE_URL;

// Load local test defaults (override: false = won't overwrite existing env vars)
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: false });

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

const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nexus_test?schema=public';

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
 * Use this in beforeAll to skip tests when no DB is available.
 */
export async function canConnectToTestDb(): Promise<boolean> {
  try {
    await testPrisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
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
    try { await testPrisma.studentProfile.deleteMany(); } catch { /* ignore */ }
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

  const studentProfile = await testPrisma.studentProfile.create({
    data: {
      userId: studentUser.id,
      grade: 'Terminale',
      school: 'Lycée Test',
      ...overrides.profile
    }
  });

  const student = await testPrisma.student.create({
    data: {
      parentId,
      userId: studentUser.id,
      grade: 'Terminale',
      ...overrides.student
    }
  });

  return { studentUser, studentProfile, student };
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
