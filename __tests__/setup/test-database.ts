import { PrismaClient } from '@prisma/client';

// Create a test database instance
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      // Prefer Postgres for tests. Fallback to local mapped DB on 5433.
      url:
        process.env.TEST_DATABASE_URL ||
        process.env.JEST_DB_URL ||
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5433/nexus_dev?schema=public',
    },
  },
});

// Test data setup utilities
export async function setupTestDatabase() {
  // Clean up existing test data
  await testPrisma.creditTransaction.deleteMany();
  await testPrisma.session.deleteMany();
  await testPrisma.student.deleteMany();
  await testPrisma.parentProfile.deleteMany();
  await testPrisma.studentProfile.deleteMany();
  await testPrisma.coachProfile.deleteMany();
  await testPrisma.subscription.deleteMany();
  await testPrisma.user.deleteMany();
}

export async function teardownTestDatabase() {
  await setupTestDatabase(); // Clean up after tests
  await testPrisma.$disconnect();
}

// Test data factories
export const createTestParent = async (overrides: any = {}) => {
  return await testPrisma.user.create({
    data: {
      email: 'test.parent@nexus-test.com',
      password: 'hashed-password',
      role: 'PARENT',
      firstName: 'Jean',
      lastName: 'Dupont',
      phone: '0123456789',
      ...overrides,
    },
  });
};

export const createTestStudent = async (parentId: string, overrides: any = {}) => {
  const studentUser = await testPrisma.user.create({
    data: {
      email: 'test.student@nexus-test.com',
      role: 'ELEVE',
      firstName: 'Marie',
      lastName: 'Dupont',
      ...overrides.user,
    },
  });

  const studentProfile = await testPrisma.studentProfile.create({
    data: {
      userId: studentUser.id,
      grade: 'Terminale',
      school: 'Lycée Test',
      ...overrides.profile,
    },
  });

  const student = await testPrisma.student.create({
    data: {
      parentId,
      userId: studentUser.id,
      grade: 'Terminale',
      ...overrides.student,
    },
  });

  return { studentUser, studentProfile, student };
};

export const createTestCoach = async (overrides: any = {}) => {
  const coachUser = await testPrisma.user.create({
    data: {
      email: 'test.coach@nexus-test.com',
      role: 'COACH',
      firstName: 'Pierre',
      lastName: 'Martin',
      ...overrides.user,
    },
  });

  const coachProfile = await testPrisma.coachProfile.create({
    data: {
      userId: coachUser.id,
      pseudonym: 'Prof_Pierre',
      subjects: JSON.stringify(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE']),
      availableOnline: true,
      ...overrides.profile,
    },
  });

  return { coachUser, coachProfile };
};

export const createTestSubscription = async (studentId: string, overrides: any = {}) => {
  return await testPrisma.subscription.create({
    data: {
      studentId,
      planName: 'HYBRIDE',
      status: 'ACTIVE',
      creditsPerMonth: 20,
      monthlyPrice: 99,
      startDate: new Date(),
      ...overrides,
    },
  });
};

export const addCreditsToStudent = async (studentId: string, amount: number) => {
  return await testPrisma.creditTransaction.create({
    data: {
      studentId,
      type: 'PURCHASE',
      amount,
      description: `Test credit allocation: ${amount} credits`,
    },
  });
};
