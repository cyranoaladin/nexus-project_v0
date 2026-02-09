/**
 * Concurrency Test - Credit Transaction Idempotency
 *
 * Verifies that the partial unique indexes prevent duplicate USAGE and REFUND
 * transactions for the same session, even when operations are concurrent.
 *
 * Invariants tested:
 * - INV-CRE-1: One debit (USAGE) per session
 * - INV-CRE-2: One refund (REFUND) per session
 * - INV-CRE-3: USAGE + REFUND allowed for same session
 */

// Mock lib/prisma to use testPrisma for concurrency tests
jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

import { PrismaClient } from '@prisma/client';
import { testPrisma, setupTestDatabase, createTestSessionBooking, createTestParent, createTestStudent } from '../setup/test-database';

const prisma = testPrisma;

describe('Credit Transaction Idempotency - Concurrency', () => {
  let studentRecordId: string;  // Student table record, not User

  beforeAll(async () => {
    await setupTestDatabase();

    // Create test data
    const { parentProfile } = await createTestParent({ email: 'credit.idempotency@test.com' });
    const { student } = await createTestStudent(parentProfile.id, { user: { email: 'student.credit@test.com' } });
    studentRecordId = student.id;
  });

  afterAll(async () => {
    await setupTestDatabase();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up credit transactions and session bookings after each test
    await prisma.creditTransaction.deleteMany({});
    await prisma.sessionBooking.deleteMany({});
  });

  describe('USAGE Transaction Idempotency (INV-CRE-1)', () => {
    it('should prevent duplicate USAGE transactions for same session', async () => {
      const session = await createTestSessionBooking();
      const usageData = {
        studentId: studentRecordId,
        type: 'USAGE',
        amount: -1,
        description: 'Session booking debit',
        sessionId: session.id
      };

      // First USAGE should succeed
      const first = await prisma.creditTransaction.create({ data: usageData });
      expect(first).toBeDefined();

      // Second USAGE for same session should fail
      await expect(
        prisma.creditTransaction.create({ data: usageData })
      ).rejects.toThrow(/Unique constraint/);
    });

    it('should handle concurrent USAGE transaction attempts', async () => {
      const session = await createTestSessionBooking();
      const usageData = {
        studentId: studentRecordId,
        type: 'USAGE',
        amount: -1,
        description: 'Concurrent booking debit',
        sessionId: session.id
      };

      // Simulate 3 concurrent debit attempts
      const results = await Promise.allSettled([
        prisma.creditTransaction.create({ data: usageData }),
        prisma.creditTransaction.create({ data: usageData }),
        prisma.creditTransaction.create({ data: usageData })
      ]);

      // Exactly one should succeed
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(2);

      // Verify only one USAGE transaction exists
      const usageTransactions = await prisma.creditTransaction.findMany({
        where: { sessionId: session.id, type: 'USAGE' }
      });
      expect(usageTransactions).toHaveLength(1);
    });

    it('should allow USAGE for different sessions', async () => {
      const session1 = await createTestSessionBooking();
      const session2 = await createTestSessionBooking();

      const usage1 = await prisma.creditTransaction.create({
        data: {
          studentId: studentRecordId,
          type: 'USAGE',
          amount: -1,
          description: 'Session 1 debit',
          sessionId: session1.id
        }
      });

      const usage2 = await prisma.creditTransaction.create({
        data: {
          studentId: studentRecordId,
          type: 'USAGE',
          amount: -1,
          description: 'Session 2 debit',
          sessionId: session2.id
        }
      });

      expect(usage1.id).not.toBe(usage2.id);
    });

    it('should allow multiple USAGE transactions without sessionId', async () => {
      // USAGE transactions not tied to a session (e.g., admin adjustments)
      const usage1 = await prisma.creditTransaction.create({
        data: {
          studentId: studentRecordId,
          type: 'USAGE',
          amount: -5,
          description: 'Manual adjustment 1',
          sessionId: null
        }
      });

      const usage2 = await prisma.creditTransaction.create({
        data: {
          studentId: studentRecordId,
          type: 'USAGE',
          amount: -3,
          description: 'Manual adjustment 2',
          sessionId: null
        }
      });

      expect(usage1.id).not.toBe(usage2.id);
    });
  });

  describe('REFUND Transaction Idempotency (INV-CRE-2)', () => {
    it('should prevent duplicate REFUND transactions for same session', async () => {
      const session = await createTestSessionBooking();
      const refundData = {
        studentId: studentRecordId,
        type: 'REFUND',
        amount: 1,
        description: 'Session cancellation refund',
        sessionId: session.id
      };

      // First REFUND should succeed
      const first = await prisma.creditTransaction.create({ data: refundData });
      expect(first).toBeDefined();

      // Second REFUND for same session should fail
      await expect(
        prisma.creditTransaction.create({ data: refundData })
      ).rejects.toThrow(/Unique constraint/);
    });

    it('should handle concurrent REFUND transaction attempts', async () => {
      const session = await createTestSessionBooking();
      const refundData = {
        studentId: studentRecordId,
        type: 'REFUND',
        amount: 1,
        description: 'Concurrent refund',
        sessionId: session.id
      };

      // Simulate 3 concurrent refund attempts
      const results = await Promise.allSettled([
        prisma.creditTransaction.create({ data: refundData }),
        prisma.creditTransaction.create({ data: refundData }),
        prisma.creditTransaction.create({ data: refundData })
      ]);

      // Exactly one should succeed
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(2);

      // Verify only one REFUND transaction exists
      const refundTransactions = await prisma.creditTransaction.findMany({
        where: { sessionId: session.id, type: 'REFUND' }
      });
      expect(refundTransactions).toHaveLength(1);
    });
  });

  describe('USAGE + REFUND Combination (INV-CRE-3)', () => {
    it('should allow both USAGE and REFUND for same session', async () => {
      const session = await createTestSessionBooking();
      // Create USAGE transaction
      const usage = await prisma.creditTransaction.create({
        data: {
          studentId: studentRecordId,
          type: 'USAGE',
          amount: -1,
          description: 'Session booking debit',
          sessionId: session.id
        }
      });

      // Create REFUND transaction for same session
      const refund = await prisma.creditTransaction.create({
        data: {
          studentId: studentRecordId,
          type: 'REFUND',
          amount: 1,
          description: 'Session cancellation refund',
          sessionId: session.id
        }
      });

      expect(usage.id).toBeDefined();
      expect(refund.id).toBeDefined();
      expect(usage.id).not.toBe(refund.id);

      // Verify both exist
      const transactions = await prisma.creditTransaction.findMany({
        where: { sessionId: session.id }
      });
      expect(transactions).toHaveLength(2);
    });

    it('should enforce idempotency even with USAGE and REFUND mix', async () => {
      const session = await createTestSessionBooking();
      // Create USAGE
      await prisma.creditTransaction.create({
        data: {
          studentId: studentRecordId,
          type: 'USAGE',
          amount: -1,
          description: 'Session debit',
          sessionId: session.id
        }
      });

      // Create REFUND
      await prisma.creditTransaction.create({
        data: {
          studentId: studentRecordId,
          type: 'REFUND',
          amount: 1,
          description: 'Session refund',
          sessionId: session.id
        }
      });

      // Try to create duplicate USAGE - should fail
      await expect(
        prisma.creditTransaction.create({
          data: {
            studentId: studentRecordId,
            type: 'USAGE',
            amount: -1,
            description: 'Duplicate debit',
            sessionId: session.id
          }
        })
      ).rejects.toThrow();

      // Try to create duplicate REFUND - should fail
      await expect(
        prisma.creditTransaction.create({
          data: {
            studentId: studentRecordId,
            type: 'REFUND',
            amount: 1,
            description: 'Duplicate refund',
            sessionId: session.id
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('Other Transaction Types', () => {
    it('should allow multiple MONTHLY_ALLOCATION transactions', async () => {
      // Monthly allocations don't have sessionId, so no idempotency constraint
      const alloc1 = await prisma.creditTransaction.create({
        data: {
          studentId: studentRecordId,
          type: 'MONTHLY_ALLOCATION',
          amount: 10,
          description: 'January allocation',
          sessionId: null
        }
      });

      const alloc2 = await prisma.creditTransaction.create({
        data: {
          studentId: studentRecordId,
          type: 'MONTHLY_ALLOCATION',
          amount: 10,
          description: 'February allocation',
          sessionId: null
        }
      });

      expect(alloc1.id).not.toBe(alloc2.id);
    });

    it('should allow multiple PURCHASE transactions', async () => {
      const purchase1 = await prisma.creditTransaction.create({
        data: {
          studentId: studentRecordId,
          type: 'PURCHASE',
          amount: 20,
          description: 'Credit pack 1',
          sessionId: null
        }
      });

      const purchase2 = await prisma.creditTransaction.create({
        data: {
          studentId: studentRecordId,
          type: 'PURCHASE',
          amount: 30,
          description: 'Credit pack 2',
          sessionId: null
        }
      });

      expect(purchase1.id).not.toBe(purchase2.id);
    });
  });
});
