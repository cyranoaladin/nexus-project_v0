/**
 * Jest Global Setup for Integration Tests
 * 
 * Provides automatic cleanup between tests to avoid constraint violations.
 * Ensures each test runs with a clean database state.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clean all tables in the correct order (respecting foreign keys)
 * Called before each test to ensure clean state
 */
export async function cleanDatabase() {
  // Disable foreign key checks temporarily for faster cleanup
  await prisma.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED;');

  try {
    // Delete in reverse dependency order to avoid foreign key violations
    
    // 1. Session-related (most dependent)
    await prisma.sessionReminder.deleteMany({});
    await prisma.sessionNotification.deleteMany({});
    await prisma.sessionReport.deleteMany({});
    await prisma.sessionBooking.deleteMany({});
    
    // 2. Student-related
    await prisma.studentBadge.deleteMany({});
    await prisma.studentReport.deleteMany({});
    await prisma.ariaMessage.deleteMany({});
    await prisma.ariaConversation.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.creditTransaction.deleteMany({});
    await prisma.subscription.deleteMany({});
    
    // 3. Communication
    await prisma.message.deleteMany({});
    
    // 4. Payments
    await prisma.payment.deleteMany({});
    
    // 5. Stage-related
    await prisma.stageReservation.deleteMany({});
    
    // 6. Diagnostics
    await prisma.diagnostic.deleteMany({});
    
    // 7. Assessments (new module)
    await prisma.$executeRawUnsafe('DELETE FROM assessments WHERE true;').catch(() => {
      // Table might not exist yet (migration not applied)
      console.log('[Test Setup] Assessment table not found, skipping cleanup');
    });
    
    // 8. Profiles (dependent on users)
    await prisma.coachAvailability.deleteMany({});
    await prisma.subscriptionRequest.deleteMany({});
    await prisma.student.deleteMany({});
    await prisma.coachProfile.deleteMany({});
    await prisma.studentProfile.deleteMany({});
    await prisma.parentProfile.deleteMany({});
    
    // 9. Users (least dependent, but referenced by many)
    await prisma.user.deleteMany({});
    
    // 10. System data (can be deleted if needed for tests)
    // Note: Badges are usually seed data, only delete if test creates them
    // await prisma.badge.deleteMany({});
    
  } finally {
    // Re-enable foreign key checks
    await prisma.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE;');
  }
}

/**
 * Setup hook - runs before each test
 */
beforeEach(async () => {
  await cleanDatabase();
});

/**
 * Teardown hook - runs after all tests
 */
afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Export prisma instance for tests
 */
export { prisma };
