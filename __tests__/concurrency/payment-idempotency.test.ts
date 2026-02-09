/**
 * Concurrency Test - Payment Idempotency
 *
 * Verifies that the unique constraint on (externalId, method) prevents
 * duplicate payment records when webhooks are called multiple times concurrently.
 *
 * Invariant tested:
 * - INV-PAY-1: Payment Idempotency
 */

// Mock lib/prisma to use testPrisma BEFORE any imports
jest.mock('@/lib/prisma', () => {
  const { testPrisma } = require('../setup/test-database');
  return { prisma: testPrisma };
});

import { PrismaClient } from '@prisma/client';
import { testPrisma, setupTestDatabase, createTestParent } from '../setup/test-database';
import { upsertPaymentByExternalId } from '@/lib/payments';

const prisma = testPrisma;

describe('Payment Idempotency - Concurrency', () => {
  let userId: string;

  beforeAll(async () => {
    await setupTestDatabase();

    const { parentUser } = await createTestParent({ email: 'payment.idempotency@test.com' });
    userId = parentUser.id;
  });

  afterAll(async () => {
    await setupTestDatabase();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up payments after each test
    await prisma.payment.deleteMany({});
  });

  describe('Direct Database Constraint', () => {
    it('should prevent duplicate payments with same externalId and method', async () => {
      const externalId = `konnect_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const paymentData = {
        userId,
        type: 'SUBSCRIPTION' as const,
        amount: 99.99,
        currency: 'TND',
        description: 'Monthly subscription',
        status: 'COMPLETED' as const,
        method: 'konnect',
        externalId
      };

      // First payment should succeed
      const first = await prisma.payment.create({ data: paymentData });
      expect(first).toBeDefined();
      expect(first.externalId).toBe(externalId);

      // Second payment with same externalId and method should fail
      await expect(
        prisma.payment.create({ data: paymentData })
      ).rejects.toThrow(/Unique constraint/);
    });

    it('should allow concurrent webhook calls with upsert pattern', async () => {
      const externalId = `konnect_tx_concurrent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const method = 'konnect';

      // Simulate 3 concurrent webhook calls for same transaction
      const results = await Promise.all([
        upsertPaymentByExternalId({
          userId,
          externalId,
          method,
          amount: 149.99,
          currency: 'TND',
          description: 'Concurrent webhook test',
          type: 'SUBSCRIPTION',
          metadata: { webhookAttempt: 1 }
        }),
        upsertPaymentByExternalId({
          userId,
          externalId,
          method,
          amount: 149.99,
          currency: 'TND',
          description: 'Concurrent webhook test',
          type: 'SUBSCRIPTION',
          metadata: { webhookAttempt: 2 }
        }),
        upsertPaymentByExternalId({
          userId,
          externalId,
          method,
          amount: 149.99,
          currency: 'TND',
          description: 'Concurrent webhook test',
          type: 'SUBSCRIPTION',
          metadata: { webhookAttempt: 3 }
        })
      ]);

      // All should return the same payment ID
      expect(results[0].payment.id).toBe(results[1].payment.id);
      expect(results[1].payment.id).toBe(results[2].payment.id);

      // At most one should be marked as created
      const createdCount = results.filter(r => r.created).length;
      expect(createdCount).toBeLessThanOrEqual(1);

      // Verify only one payment exists in database
      const payments = await prisma.payment.findMany({
        where: { externalId, method }
      });
      expect(payments).toHaveLength(1);
      expect(payments[0].externalId).toBe(externalId);
    });

    it('should allow same externalId with different payment method', async () => {
      const externalId = `external_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create payment with konnect
      const konnect = await prisma.payment.create({
        data: {
          userId,
          type: 'SUBSCRIPTION',
          amount: 99.99,
          currency: 'TND',
          description: 'Konnect payment',
          method: 'konnect',
          externalId
        }
      });

      // Create payment with wise (different method)
      const wise = await prisma.payment.create({
        data: {
          userId,
          type: 'SUBSCRIPTION',
          amount: 99.99,
          currency: 'USD',
          description: 'Wise payment',
          method: 'wise',
          externalId
        }
      });

      expect(konnect.id).toBeDefined();
      expect(wise.id).toBeDefined();
      expect(konnect.id).not.toBe(wise.id);
    });

    it('should allow multiple payments with NULL externalId', async () => {
      // Manual payments don't have externalId
      const payment1 = await prisma.payment.create({
        data: {
          userId,
          type: 'SUBSCRIPTION',
          amount: 100,
          currency: 'TND',
          description: 'Manual payment 1',
          method: 'manual',
          externalId: null
        }
      });

      const payment2 = await prisma.payment.create({
        data: {
          userId,
          type: 'SUBSCRIPTION',
          amount: 200,
          currency: 'TND',
          description: 'Manual payment 2',
          method: 'manual',
          externalId: null
        }
      });

      expect(payment1.id).not.toBe(payment2.id);
    });
  });

  describe('Upsert Pattern Behavior', () => {
    it('should return existing payment on second call', async () => {
      const externalId = `konnect_tx_upsert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const method = 'konnect';

      // First call creates payment
      const result1 = await upsertPaymentByExternalId({
        userId,
        externalId,
        method,
        amount: 199.99,
        currency: 'TND',
        description: 'First upsert',
        type: 'SUBSCRIPTION',
        metadata: { attempt: 1 }
      });

      expect(result1.created).toBe(true);
      expect(result1.payment.externalId).toBe(externalId);

      // Second call returns existing payment
      const result2 = await upsertPaymentByExternalId({
        userId,
        externalId,
        method,
        amount: 199.99,
        currency: 'TND',
        description: 'Second upsert',
        type: 'SUBSCRIPTION',
        metadata: { attempt: 2 }
      });

      expect(result2.created).toBe(false);
      expect(result2.payment.id).toBe(result1.payment.id);

      // Original status is preserved (not updated)
      expect(result2.payment.status).toBe('PENDING');
    });

    it('should handle race condition in upsert gracefully', async () => {
      const externalId = `konnect_tx_race_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const method = 'konnect';

      // Simulate race: both threads check "not exists", then both try to create
      const createAttempts = await Promise.allSettled([
        prisma.payment.create({
          data: {
            userId,
            type: 'SUBSCRIPTION',
            amount: 99.99,
            currency: 'TND',
            description: 'Race attempt 1',
            method,
            externalId
          }
        }),
        prisma.payment.create({
          data: {
            userId,
            type: 'SUBSCRIPTION',
            amount: 99.99,
            currency: 'TND',
            description: 'Race attempt 2',
            method,
            externalId
          }
        })
      ]);

      // One should succeed, one should fail with P2002
      const fulfilled = createAttempts.filter(r => r.status === 'fulfilled');
      const rejected = createAttempts.filter(r => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      // The rejected one should be P2002 error
      const error = (rejected[0] as PromiseRejectedResult).reason;
      expect(error.code).toBe('P2002');
    });
  });
});
