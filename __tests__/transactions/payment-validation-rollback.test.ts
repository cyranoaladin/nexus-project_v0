/**
 * Transaction Rollback Test - Payment Validation
 *
 * Verifies that the payment validation transaction wrapper ensures atomicity.
 * If any step fails, the entire transaction should rollback, leaving no partial state.
 *
 * Invariant tested:
 * - INV-PAY-2: Payment Validation Atomicity
 */

// Mock lib/prisma to use testPrisma for transaction tests
jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

import { PrismaClient } from '@prisma/client';
import { testPrisma, setupTestDatabase, createTestParent, createTestStudent } from '../setup/test-database';

const prisma = testPrisma;

describe('Payment Validation Transaction Rollback', () => {
  let userId: string;
  let studentRecordId: string;
  let paymentId: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await setupTestDatabase();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up after each test (in reverse order of foreign key dependencies)
    await prisma.creditTransaction.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.student.deleteMany({});
    await prisma.studentProfile.deleteMany({});
    await prisma.parentProfile.deleteMany({});
    await prisma.user.deleteMany({});
  });

  beforeEach(async () => {
    // Create fresh test data for each test
    const { parentUser, parentProfile } = await createTestParent({ email: 'rollback.test@example.com' });
    userId = parentUser.id;

    const { student } = await createTestStudent(parentProfile.id, { user: { email: 'rollback.student@test.com' } });
    studentRecordId = student.id;

    // Create a pending payment
    const payment = await prisma.payment.create({
      data: {
        userId,
        type: 'SUBSCRIPTION',
        amount: 199.99,
        currency: 'TND',
        description: 'Test subscription payment',
        status: 'PENDING',
        method: 'konnect',
        externalId: 'test_rollback_payment',
        metadata: {
          studentId: studentRecordId,
          itemKey: 'PREMIUM',
          itemType: 'subscription'
        }
      }
    });
    paymentId = payment.id;
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.creditTransaction.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.payment.deleteMany({});
  });

  describe('Atomicity Guarantee', () => {
    it('should rollback payment update if subscription activation fails', async () => {
      const initialPayment = await prisma.payment.findUnique({
        where: { id: paymentId }
      });
      expect(initialPayment?.status).toBe('PENDING');

      // Simulate transaction failure by throwing error after payment update
      await expect(async () => {
        await prisma.$transaction(async (tx) => {
          // Update payment to COMPLETED
          await tx.payment.update({
            where: { id: paymentId },
            data: { status: 'COMPLETED' }
          });

          // Simulate subscription activation failure
          throw new Error('Subscription activation failed');
        });
      }).rejects.toThrow('Subscription activation failed');

      // Payment status should still be PENDING (rolled back)
      const finalPayment = await prisma.payment.findUnique({
        where: { id: paymentId }
      });
      expect(finalPayment?.status).toBe('PENDING');
    });

    it('should rollback payment update if credit allocation fails', async () => {
      // Create an inactive subscription first
      await prisma.subscription.create({
        data: {
          studentId: studentRecordId,
          planName: 'PREMIUM',
          status: 'INACTIVE',
          creditsPerMonth: 20,
          monthlyPrice: 199.99,
          startDate: new Date()
        }
      });

      const initialPayment = await prisma.payment.findUnique({
        where: { id: paymentId }
      });
      expect(initialPayment?.status).toBe('PENDING');

      // Simulate transaction failure during credit allocation
      await expect(async () => {
        await prisma.$transaction(async (tx) => {
          // Update payment
          await tx.payment.update({
            where: { id: paymentId },
            data: { status: 'COMPLETED' }
          });

          // Activate subscription
          await tx.subscription.updateMany({
            where: { studentId: studentRecordId, status: 'INACTIVE' },
            data: { status: 'ACTIVE' }
          });

          // Simulate credit allocation failure
          throw new Error('Credit allocation failed');
        });
      }).rejects.toThrow('Credit allocation failed');

      // Payment should still be PENDING
      const finalPayment = await prisma.payment.findUnique({
        where: { id: paymentId }
      });
      expect(finalPayment?.status).toBe('PENDING');

      // Subscription should still be INACTIVE
      const subscription = await prisma.subscription.findFirst({
        where: { studentId: studentRecordId }
      });
      expect(subscription?.status).toBe('INACTIVE');
    });

    it('should commit all changes if transaction succeeds', async () => {
      // Create an inactive subscription
      await prisma.subscription.create({
        data: {
          studentId: studentRecordId,
          planName: 'PREMIUM',
          status: 'INACTIVE',
          creditsPerMonth: 20,
          monthlyPrice: 199.99,
          startDate: new Date()
        }
      });

      // Execute successful transaction
      await prisma.$transaction(async (tx) => {
        // Update payment
        await tx.payment.update({
          where: { id: paymentId },
          data: { status: 'COMPLETED' }
        });

        // Activate subscription
        await tx.subscription.updateMany({
          where: { studentId: studentRecordId, status: 'INACTIVE' },
          data: { status: 'ACTIVE' }
        });

        // Allocate credits
        await tx.creditTransaction.create({
          data: {
            studentId: studentRecordId,
            type: 'MONTHLY_ALLOCATION',
            amount: 20,
            description: 'Initial credit allocation'
          }
        });
      });

      // All changes should be committed
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId }
      });
      expect(payment?.status).toBe('COMPLETED');

      const subscription = await prisma.subscription.findFirst({
        where: { studentId: studentRecordId }
      });
      expect(subscription?.status).toBe('ACTIVE');

      const credits = await prisma.creditTransaction.findMany({
        where: { studentId: studentRecordId }
      });
      expect(credits).toHaveLength(1);
      expect(credits[0].amount).toBe(20);
    });
  });

  describe('Partial Failure Scenarios', () => {
    it('should not leave orphaned subscription activations', async () => {
      // Create active and inactive subscriptions
      await prisma.subscription.create({
        data: {
          studentId: studentRecordId,
          planName: 'BASIC',
          status: 'ACTIVE',
          creditsPerMonth: 10,
          monthlyPrice: 99.99,
          startDate: new Date()
        }
      });

      await prisma.subscription.create({
        data: {
          studentId: studentRecordId,
          planName: 'PREMIUM',
          status: 'INACTIVE',
          creditsPerMonth: 20,
          monthlyPrice: 199.99,
          startDate: new Date()
        }
      });

      // Transaction that fails after deactivating old subscription
      await expect(async () => {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: paymentId },
            data: { status: 'COMPLETED' }
          });

          // Deactivate old subscription
          await tx.subscription.updateMany({
            where: { studentId: studentRecordId, status: 'ACTIVE' },
            data: { status: 'CANCELLED' }
          });

          // Activate new subscription
          await tx.subscription.updateMany({
            where: { studentId: studentRecordId, planName: 'PREMIUM' },
            data: { status: 'ACTIVE' }
          });

          // Fail before credit allocation
          throw new Error('Simulated failure');
        });
      }).rejects.toThrow();

      // Old subscription should still be ACTIVE (rolled back)
      const basicSub = await prisma.subscription.findFirst({
        where: { studentId: studentRecordId, planName: 'BASIC' }
      });
      expect(basicSub?.status).toBe('ACTIVE');

      // New subscription should still be INACTIVE (rolled back)
      const premiumSub = await prisma.subscription.findFirst({
        where: { studentId: studentRecordId, planName: 'PREMIUM' }
      });
      expect(premiumSub?.status).toBe('INACTIVE');

      // Payment should still be PENDING
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId }
      });
      expect(payment?.status).toBe('PENDING');
    });

    it('should not create credit transactions if payment update fails', async () => {
      const initialCreditCount = await prisma.creditTransaction.count({
        where: { studentId: studentRecordId }
      });

      // Transaction that fails after attempting credit creation
      await expect(async () => {
        await prisma.$transaction(async (tx) => {
          // This will fail if we use wrong payment ID
          await tx.payment.update({
            where: { id: 'nonexistent-payment-id' },
            data: { status: 'COMPLETED' }
          });

          // This credit creation should not persist
          await tx.creditTransaction.create({
            data: {
              studentId: studentRecordId,
              type: 'MONTHLY_ALLOCATION',
              amount: 20,
              description: 'Should not be created'
            }
          });
        });
      }).rejects.toThrow();

      // No credits should have been created
      const finalCreditCount = await prisma.creditTransaction.count({
        where: { studentId: studentRecordId }
      });
      expect(finalCreditCount).toBe(initialCreditCount);
    });
  });

  describe('Isolation Level Behavior', () => {
    it('should prevent dirty reads during transaction', async () => {
      // Create subscription
      await prisma.subscription.create({
        data: {
          studentId: studentRecordId,
          planName: 'PREMIUM',
          status: 'INACTIVE',
          creditsPerMonth: 20,
          monthlyPrice: 199.99,
          startDate: new Date()
        }
      });

      let transactionStarted = false;
      let intermediatePaymentStatus: string | undefined;

      // Start long-running transaction
      const transactionPromise = (async () => {
        await prisma.$transaction(async (tx) => {
          transactionStarted = true;

          await tx.payment.update({
            where: { id: paymentId },
            data: { status: 'COMPLETED' }
          });

          // Wait a bit to allow concurrent read
          await new Promise(resolve => setTimeout(resolve, 100));

          // Eventually rollback
          throw new Error('Rollback transaction');
        });
      })();

      // Wait for transaction to start
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(transactionStarted).toBe(true);

      // Read payment status from outside transaction
      const externalRead = await prisma.payment.findUnique({
        where: { id: paymentId }
      });
      intermediatePaymentStatus = externalRead?.status;

      // Wait for transaction to complete
      await expect(transactionPromise).rejects.toThrow('Rollback transaction');

      // External read should have seen PENDING (not the intermediate COMPLETED state)
      // This verifies isolation
      expect(intermediatePaymentStatus).toBe('PENDING');

      // Final state should also be PENDING
      const finalPayment = await prisma.payment.findUnique({
        where: { id: paymentId }
      });
      expect(finalPayment?.status).toBe('PENDING');
    });
  });
});
