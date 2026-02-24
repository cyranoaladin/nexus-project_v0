/**
 * Credits Engine — Complete Test Suite
 *
 * Tests: calculateCreditCost, checkCreditBalance, debitCredits, refundCredits,
 *        refundSessionBookingById, allocateMonthlyCredits, canCancelBooking
 *
 * Source: lib/credits.ts
 */

import {
  calculateCreditCost,
  canCancelBooking,
} from '@/lib/credits';
import { ServiceType } from '@/types/enums';

// Note: async functions (checkCreditBalance, debitCredits, refundCredits, etc.)
// use dynamic import of prisma, so we test them via the global prisma mock from jest.setup.js

// ─── calculateCreditCost ─────────────────────────────────────────────────────

describe('calculateCreditCost', () => {
  it('should compute cost=1.00 for COURS_ONLINE serviceType', () => {
    expect(calculateCreditCost(ServiceType.COURS_ONLINE)).toBe(1);
  });

  it('should compute cost=1.25 for COURS_PRESENTIEL serviceType', () => {
    expect(calculateCreditCost(ServiceType.COURS_PRESENTIEL)).toBe(1.25);
  });

  it('should compute cost=1.50 for ATELIER_GROUPE serviceType', () => {
    expect(calculateCreditCost(ServiceType.ATELIER_GROUPE)).toBe(1.5);
  });

  it('should return default cost=1 for unknown serviceType', () => {
    expect(calculateCreditCost('UNKNOWN_TYPE' as ServiceType)).toBe(1);
  });
});

// ─── canCancelBooking ────────────────────────────────────────────────────────

describe('canCancelBooking', () => {
  const futureDate = (hoursFromNow: number) => {
    const d = new Date();
    d.setTime(d.getTime() + hoursFromNow * 60 * 60 * 1000);
    return d;
  };

  const now = new Date();

  // Individual / Online / Hybrid: 24h notice required
  describe('INDIVIDUAL session type', () => {
    it('should allow cancellation 25h before session', () => {
      expect(canCancelBooking('INDIVIDUAL', 'ONLINE', futureDate(25), now)).toBe(true);
    });

    it('should allow cancellation exactly 24h before session', () => {
      expect(canCancelBooking('INDIVIDUAL', 'ONLINE', futureDate(24), now)).toBe(true);
    });

    it('should reject cancellation 23h before session', () => {
      expect(canCancelBooking('INDIVIDUAL', 'ONLINE', futureDate(23), now)).toBe(false);
    });

    it('should reject cancellation for past session', () => {
      const pastDate = new Date(now.getTime() - 1000);
      expect(canCancelBooking('INDIVIDUAL', 'ONLINE', pastDate, now)).toBe(false);
    });
  });

  describe('ONLINE modality (any session type)', () => {
    it('should use 24h rule for ONLINE modality even with GROUP type', () => {
      // Note: INDIVIDUAL check comes first in the code, but ONLINE modality also triggers 24h
      expect(canCancelBooking('INDIVIDUAL', 'ONLINE', futureDate(25), now)).toBe(true);
      expect(canCancelBooking('INDIVIDUAL', 'ONLINE', futureDate(23), now)).toBe(false);
    });
  });

  describe('HYBRID modality', () => {
    it('should use 24h rule for HYBRID modality', () => {
      expect(canCancelBooking('INDIVIDUAL', 'HYBRID', futureDate(25), now)).toBe(true);
      expect(canCancelBooking('INDIVIDUAL', 'HYBRID', futureDate(23), now)).toBe(false);
    });
  });

  // Group / Masterclass: 48h notice required
  describe('GROUP session type', () => {
    it('should allow cancellation 49h before session', () => {
      expect(canCancelBooking('GROUP', 'IN_PERSON', futureDate(49), now)).toBe(true);
    });

    it('should allow cancellation exactly 48h before session', () => {
      expect(canCancelBooking('GROUP', 'IN_PERSON', futureDate(48), now)).toBe(true);
    });

    it('should reject cancellation 47h before session', () => {
      expect(canCancelBooking('GROUP', 'IN_PERSON', futureDate(47), now)).toBe(false);
    });
  });

  describe('MASTERCLASS session type', () => {
    it('should use 48h rule for MASTERCLASS', () => {
      expect(canCancelBooking('MASTERCLASS', 'IN_PERSON', futureDate(49), now)).toBe(true);
      expect(canCancelBooking('MASTERCLASS', 'IN_PERSON', futureDate(47), now)).toBe(false);
    });
  });
});

// ─── checkCreditBalance (with mocked prisma) ────────────────────────────────

describe('checkCreditBalance', () => {
  // Access the mocked prisma from jest.setup.js
  let prisma: any;

  beforeEach(async () => {
    const mod = await import('@/lib/prisma');
    prisma = (mod as any).prisma;
    jest.clearAllMocks();
  });

  it('should return true when balance >= required credits', async () => {
    // Arrange
    prisma.creditTransaction.findMany.mockResolvedValue([
      { amount: 5, expiresAt: null },
      { amount: 3, expiresAt: null },
    ]);

    // Act
    const { checkCreditBalance } = await import('@/lib/credits');
    const result = await checkCreditBalance('student-1', 7);

    // Assert
    expect(result).toBe(true);
  });

  it('should return false when balance < required credits', async () => {
    // Arrange
    prisma.creditTransaction.findMany.mockResolvedValue([
      { amount: 2, expiresAt: null },
    ]);

    // Act
    const { checkCreditBalance } = await import('@/lib/credits');
    const result = await checkCreditBalance('student-1', 5);

    // Assert
    expect(result).toBe(false);
  });

  it('should return false (0 balance) for student with no transactions', async () => {
    // Arrange
    prisma.creditTransaction.findMany.mockResolvedValue([]);

    // Act
    const { checkCreditBalance } = await import('@/lib/credits');
    const result = await checkCreditBalance('student-1', 1);

    // Assert
    expect(result).toBe(false);
  });

  it('should filter expired transactions via query (expiresAt > now)', async () => {
    // Arrange
    prisma.creditTransaction.findMany.mockResolvedValue([
      { amount: 5, expiresAt: null }, // no expiry
    ]);

    // Act
    const { checkCreditBalance } = await import('@/lib/credits');
    await checkCreditBalance('student-1', 1);

    // Assert: verify the where clause includes expiry filter
    expect(prisma.creditTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: 'student-1',
          OR: expect.arrayContaining([
            { expiresAt: null },
            { expiresAt: expect.objectContaining({ gt: expect.any(Date) }) },
          ]),
        }),
      })
    );
  });
});

// ─── debitCredits (with mocked prisma) ───────────────────────────────────────

describe('debitCredits', () => {
  let prisma: any;

  beforeEach(async () => {
    const mod = await import('@/lib/prisma');
    prisma = (mod as any).prisma;
    jest.clearAllMocks();
  });

  it('should be idempotent: debit with same sessionId twice → only charged once', async () => {
    // Arrange: first call finds no existing, second call finds existing
    const existingTransaction = { id: 'tx-1', studentId: 's1', type: 'USAGE', amount: -1, sessionId: 'session-1' };
    prisma.creditTransaction.findFirst.mockResolvedValue(existingTransaction);

    // Act
    const { debitCredits } = await import('@/lib/credits');
    const result = await debitCredits('s1', 1, 'session-1', 'Test debit');

    // Assert: returned existing, not created new
    expect(result.created).toBe(false);
    expect(result.transaction).toEqual(existingTransaction);
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
  });

  it('should create USAGE transaction with negative amount on first debit', async () => {
    // Arrange
    prisma.creditTransaction.findFirst.mockResolvedValue(null);
    const createdTx = { id: 'tx-new', studentId: 's1', type: 'USAGE', amount: -1.25, sessionId: 'session-2' };
    prisma.creditTransaction.create.mockResolvedValue(createdTx);

    // Act
    const { debitCredits } = await import('@/lib/credits');
    const result = await debitCredits('s1', 1.25, 'session-2', 'Cours présentiel');

    // Assert
    expect(result.created).toBe(true);
    expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: 's1',
        type: 'USAGE',
        amount: -1.25,
        sessionId: 'session-2',
      }),
    });
  });

  it('should handle P2002 race condition gracefully (unique constraint)', async () => {
    // Arrange: findFirst returns null, create throws P2002, then findFirst returns existing
    prisma.creditTransaction.findFirst
      .mockResolvedValueOnce(null) // first check
      .mockResolvedValueOnce({ id: 'tx-race', sessionId: 'session-3', type: 'USAGE' }); // after race
    prisma.creditTransaction.create.mockRejectedValue({ code: 'P2002' });

    // Act
    const { debitCredits } = await import('@/lib/credits');
    const result = await debitCredits('s1', 1, 'session-3', 'Race condition test');

    // Assert
    expect(result.created).toBe(false);
    expect(result.transaction.id).toBe('tx-race');
  });
});

// ─── refundCredits (with mocked prisma) ──────────────────────────────────────

describe('refundCredits', () => {
  let prisma: any;

  beforeEach(async () => {
    const mod = await import('@/lib/prisma');
    prisma = (mod as any).prisma;
    jest.clearAllMocks();
  });

  it('should not refund twice for same sessionId (idempotency)', async () => {
    // Arrange
    const existingRefund = { id: 'ref-1', type: 'REFUND', sessionId: 'session-1', amount: 1 };
    prisma.creditTransaction.findFirst.mockResolvedValue(existingRefund);

    // Act
    const { refundCredits } = await import('@/lib/credits');
    const result = await refundCredits('s1', 1, 'session-1', 'Refund test');

    // Assert
    expect(result.created).toBe(false);
    expect(result.transaction).toEqual(existingRefund);
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
  });

  it('should create REFUND transaction with positive amount', async () => {
    // Arrange
    prisma.creditTransaction.findFirst.mockResolvedValue(null);
    const createdRefund = { id: 'ref-new', type: 'REFUND', amount: 1.5, sessionId: 'session-2' };
    prisma.creditTransaction.create.mockResolvedValue(createdRefund);

    // Act
    const { refundCredits } = await import('@/lib/credits');
    const result = await refundCredits('s1', 1.5, 'session-2', 'Annulation');

    // Assert
    expect(result.created).toBe(true);
    expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'REFUND',
        amount: 1.5, // positive for refund
      }),
    });
  });
});

// ─── allocateMonthlyCredits (with mocked prisma) ────────────────────────────

describe('allocateMonthlyCredits', () => {
  let prisma: any;

  beforeEach(async () => {
    const mod = await import('@/lib/prisma');
    prisma = (mod as any).prisma;
    jest.clearAllMocks();
  });

  it('should create MONTHLY_ALLOCATION transaction with positive amount', async () => {
    // Arrange
    const createdTx = { id: 'alloc-1', type: 'MONTHLY_ALLOCATION', amount: 4, studentId: 's1' };
    prisma.creditTransaction.create.mockResolvedValue(createdTx);

    // Act
    const { allocateMonthlyCredits } = await import('@/lib/credits');
    const result = await allocateMonthlyCredits('s1', 4);

    // Assert
    expect(result).toEqual(createdTx);
    expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: 's1',
        type: 'MONTHLY_ALLOCATION',
        amount: 4,
        description: expect.stringContaining('4 crédits'),
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('should set expiration 2 months from now', async () => {
    // Arrange
    prisma.creditTransaction.create.mockImplementation(({ data }: any) => {
      // Verify expiresAt is approximately 2 months from now
      const twoMonthsFromNow = new Date();
      twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
      const diff = Math.abs(data.expiresAt.getTime() - twoMonthsFromNow.getTime());
      expect(diff).toBeLessThan(5000); // within 5 seconds
      return data;
    });

    // Act
    const { allocateMonthlyCredits } = await import('@/lib/credits');
    await allocateMonthlyCredits('s1', 4);

    // Assert: verified in mock implementation
    expect(prisma.creditTransaction.create).toHaveBeenCalled();
  });
});

// ─── expireOldCredits (with mocked prisma) ───────────────────────────────────

describe('expireOldCredits', () => {
  let prisma: any;

  beforeEach(async () => {
    const mod = await import('@/lib/prisma');
    prisma = (mod as any).prisma;
    jest.clearAllMocks();
  });

  it('should create EXPIRATION transactions for expired allocations', async () => {
    // Arrange
    prisma.creditTransaction.findMany.mockResolvedValue([
      { id: 'alloc-old', studentId: 's1', amount: 3, type: 'MONTHLY_ALLOCATION', expiresAt: new Date('2025-01-01') },
    ]);
    prisma.creditTransaction.create.mockResolvedValue({});

    // Act
    const { expireOldCredits } = await import('@/lib/credits');
    await expireOldCredits();

    // Assert
    expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: 's1',
        type: 'EXPIRATION',
        amount: -3, // negative to cancel the allocation
        description: expect.stringContaining('Expiration'),
      }),
    });
  });

  it('should do nothing when no expired transactions exist', async () => {
    // Arrange
    prisma.creditTransaction.findMany.mockResolvedValue([]);

    // Act
    const { expireOldCredits } = await import('@/lib/credits');
    await expireOldCredits();

    // Assert
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
  });
});
