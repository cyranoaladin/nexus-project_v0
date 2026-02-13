import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables FIRST (override any existing vars)
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

// Keep both variables aligned to avoid implicit Prisma connections using DATABASE_URL
if (!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL) {
  process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
}
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Create a test database instance AFTER loading env vars
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'file:./test.db'
    }
  }
});

// Test data setup utilities
export async function setupTestDatabase() {
  // Clean up existing test data (in order of foreign key dependencies)
  await testPrisma.sessionReminder.deleteMany();
  await testPrisma.sessionNotification.deleteMany();
  await testPrisma.creditTransaction.deleteMany();
  await testPrisma.sessionBooking.deleteMany();  // FK: studentId, coachId, parentId -> User
  await testPrisma.session.deleteMany();
  await testPrisma.ariaMessage.deleteMany();
  await testPrisma.ariaConversation.deleteMany();
  await testPrisma.studentBadge.deleteMany();
  await testPrisma.badge.deleteMany();
  await testPrisma.studentReport.deleteMany();
  await testPrisma.message.deleteMany();  // FK: senderId, receiverId -> User (SetNull)
  await testPrisma.payment.deleteMany();  // FK: userId -> User
  await testPrisma.coachAvailability.deleteMany();  // FK: coachId -> User (via CoachProfile)
  await testPrisma.student.deleteMany();
  await testPrisma.subscription.deleteMany();
  await testPrisma.parentProfile.deleteMany();
  await testPrisma.studentProfile.deleteMany();
  await testPrisma.coachProfile.deleteMany();
  await testPrisma.user.deleteMany();
}

export async function teardownTestDatabase() {
  await setupTestDatabase(); // Clean up after tests
  await testPrisma.$disconnect();
}

// Test data factories
export const createTestParent = async (overrides: any = {}) => {
  // Generate unique email if not provided in overrides
  const uniqueEmail = overrides.email || `test.parent.${Date.now()}.${Math.random().toString(36).substr(2, 9)}@nexus-test.com`;

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
      email: `test.student.${Date.now()}.${Math.random().toString(36).substr(2, 9)}@nexus-test.com`,
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
  const coachUser = await testPrisma.user.create({
    data: {
      email: `test.coach.${Date.now()}.${Math.random().toString(36).substr(2, 9)}@nexus-test.com`,
      role: 'COACH',
      firstName: 'Pierre',
      lastName: 'Martin',
      ...overrides.user
    }
  });

  const coachProfile = await testPrisma.coachProfile.create({
    data: {
      userId: coachUser.id,
      pseudonym: `Prof_Pierre_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
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

  return await testPrisma.sessionBooking.create({
    data: {
      coachId: coachId!,
      studentId: studentId!,
      subject: 'MATHEMATIQUES',
      title: 'Test session',
      scheduledDate: new Date('2026-03-15'),
      startTime: '14:00',
      endTime: '15:00',
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
