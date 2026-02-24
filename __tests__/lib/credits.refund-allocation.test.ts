/**
 * Credits Refund & Allocation — Complete Test Suite
 *
 * Tests: refundCredits, refundSessionBookingById, allocateMonthlyCredits, expireOldCredits
 *
 * Source: lib/credits.ts
 */

import {
  refundCredits,
  refundSessionBookingById,
  allocateMonthlyCredits,
  expireOldCredits,
} from '@/lib/credits';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

// ─── refundCredits ───────────────────────────────────────────────────────────

describe('refundCredits', () => {
  it('should create a new REFUND transaction when none exists', async () => {
    prisma.creditTransaction.findFirst.mockResolvedValue(null);
    prisma.creditTransaction.create.mockResolvedValue({
      id: 'ct-1',
      studentId: 'stu-1',
      type: 'REFUND',
      amount: 2,
      description: 'Refund: cancellation',
      sessionId: 'sess-1',
    });

    const result = await refundCredits('stu-1', 2, 'sess-1', 'Refund: cancellation');

    expect(result.created).toBe(true);
    expect(result.transaction.type).toBe('REFUND');
    expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'stu-1',
          type: 'REFUND',
          amount: 2,
          sessionId: 'sess-1',
        }),
      })
    );
  });

  it('should return existing transaction (idempotency) when REFUND already exists', async () => {
    const existing = {
      id: 'ct-existing',
      studentId: 'stu-1',
      type: 'REFUND',
      amount: 2,
      sessionId: 'sess-1',
    };
    prisma.creditTransaction.findFirst.mockResolvedValue(existing);

    const result = await refundCredits('stu-1', 2, 'sess-1', 'Refund: cancellation');

    expect(result.created).toBe(false);
    expect(result.transaction.id).toBe('ct-existing');
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
  });

  it('should handle P2002 unique constraint race condition', async () => {
    prisma.creditTransaction.findFirst
      .mockResolvedValueOnce(null) // first check: no existing
      .mockResolvedValueOnce({ id: 'ct-race', type: 'REFUND' }); // after race: found
    prisma.creditTransaction.create.mockRejectedValue({ code: 'P2002' });

    const result = await refundCredits('stu-1', 2, 'sess-1', 'Refund');

    expect(result.created).toBe(false);
    expect(result.transaction.id).toBe('ct-race');
  });

  it('should throw on non-P2002 errors', async () => {
    prisma.creditTransaction.findFirst.mockResolvedValue(null);
    prisma.creditTransaction.create.mockRejectedValue(new Error('DB connection failed'));

    await expect(refundCredits('stu-1', 2, 'sess-1', 'Refund')).rejects.toThrow('DB connection failed');
  });
});

// ─── refundSessionBookingById ────────────────────────────────────────────────

describe('refundSessionBookingById', () => {
  it('should return SESSION_NOT_FOUND when booking does not exist', async () => {
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        sessionBooking: { findUnique: jest.fn().mockResolvedValue(null) },
        creditTransaction: { findFirst: jest.fn(), create: jest.fn() },
        student: { findFirst: jest.fn() },
      };
      return fn(tx);
    });

    const result = await refundSessionBookingById('nonexistent');
    expect(result.ok).toBe(false);
    expect((result as any).reason).toBe('SESSION_NOT_FOUND');
  });

  it('should return NOT_CANCELLED when booking is not cancelled', async () => {
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        sessionBooking: {
          findUnique: jest.fn().mockResolvedValue({ id: 'sb-1', status: 'CONFIRMED', creditsUsed: 2, studentId: 'user-1' }),
        },
        creditTransaction: { findFirst: jest.fn(), create: jest.fn() },
        student: { findFirst: jest.fn() },
      };
      return fn(tx);
    });

    const result = await refundSessionBookingById('sb-1');
    expect(result.ok).toBe(false);
    expect((result as any).reason).toBe('NOT_CANCELLED');
  });

  it('should return alreadyRefunded when REFUND already exists', async () => {
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        sessionBooking: {
          findUnique: jest.fn().mockResolvedValue({ id: 'sb-1', status: 'CANCELLED', creditsUsed: 2, studentId: 'user-1' }),
        },
        creditTransaction: {
          findFirst: jest.fn().mockResolvedValue({ id: 'ct-existing', type: 'REFUND' }),
          create: jest.fn(),
        },
        student: { findFirst: jest.fn() },
      };
      return fn(tx);
    });

    const result = await refundSessionBookingById('sb-1');
    expect(result.ok).toBe(true);
    expect((result as any).alreadyRefunded).toBe(true);
  });

  it('should return STUDENT_NOT_FOUND when student entity missing', async () => {
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        sessionBooking: {
          findUnique: jest.fn().mockResolvedValue({ id: 'sb-1', status: 'CANCELLED', creditsUsed: 2, studentId: 'user-1' }),
        },
        creditTransaction: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        student: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      return fn(tx);
    });

    const result = await refundSessionBookingById('sb-1');
    expect(result.ok).toBe(false);
    expect((result as any).reason).toBe('STUDENT_NOT_FOUND');
  });

  it('should create refund transaction for valid cancelled booking', async () => {
    const mockCreate = jest.fn().mockResolvedValue({ id: 'ct-new', type: 'REFUND', amount: 2 });
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        sessionBooking: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sb-1', status: 'CANCELLED', creditsUsed: 2, studentId: 'user-1', title: 'Maths session',
          }),
        },
        creditTransaction: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: mockCreate,
        },
        student: { findFirst: jest.fn().mockResolvedValue({ id: 'stu-1' }) },
      };
      return fn(tx);
    });

    const result = await refundSessionBookingById('sb-1');
    expect(result.ok).toBe(true);
    expect((result as any).transaction.type).toBe('REFUND');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'stu-1',
          type: 'REFUND',
          amount: 2,
        }),
      })
    );
  });

  it('should use custom reason in description when provided', async () => {
    const mockCreate = jest.fn().mockResolvedValue({ id: 'ct-new', type: 'REFUND' });
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        sessionBooking: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sb-1', status: 'CANCELLED', creditsUsed: 1, studentId: 'user-1', title: null,
          }),
        },
        creditTransaction: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: mockCreate,
        },
        student: { findFirst: jest.fn().mockResolvedValue({ id: 'stu-1' }) },
      };
      return fn(tx);
    });

    await refundSessionBookingById('sb-1', 'Coach unavailable');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'Refund: Coach unavailable',
        }),
      })
    );
  });

  it('should handle serialization conflict gracefully', async () => {
    prisma.$transaction.mockRejectedValue({ code: 'P2034', message: 'serialization failure' });
    prisma.creditTransaction.findFirst.mockResolvedValue({ id: 'ct-race', type: 'REFUND' });

    const result = await refundSessionBookingById('sb-1');
    expect(result.ok).toBe(true);
    expect((result as any).alreadyRefunded).toBe(true);
  });
});

// ─── allocateMonthlyCredits ──────────────────────────────────────────────────

describe('allocateMonthlyCredits', () => {
  it('should create a MONTHLY_ALLOCATION transaction', async () => {
    prisma.creditTransaction.create.mockResolvedValue({
      id: 'ct-monthly',
      studentId: 'stu-1',
      type: 'MONTHLY_ALLOCATION',
      amount: 8,
    });

    const result = await allocateMonthlyCredits('stu-1', 8);

    expect(result.type).toBe('MONTHLY_ALLOCATION');
    expect(result.amount).toBe(8);
    expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'stu-1',
          type: 'MONTHLY_ALLOCATION',
          amount: 8,
          description: expect.stringContaining('8 crédits'),
        }),
      })
    );
  });

  it('should set expiration date ~2 months from now', async () => {
    prisma.creditTransaction.create.mockImplementation(async (args: any) => {
      const expiresAt = args.data.expiresAt;
      expect(expiresAt).toBeInstanceOf(Date);
      // Should be approximately 2 months from now
      const twoMonthsMs = 2 * 30 * 24 * 60 * 60 * 1000;
      const diff = expiresAt.getTime() - Date.now();
      expect(diff).toBeGreaterThan(twoMonthsMs * 0.8);
      expect(diff).toBeLessThan(twoMonthsMs * 1.2);
      return { id: 'ct-monthly', type: 'MONTHLY_ALLOCATION', amount: 4 };
    });

    await allocateMonthlyCredits('stu-1', 4);
  });
});

// ─── expireOldCredits ────────────────────────────────────────────────────────

describe('expireOldCredits', () => {
  it('should create EXPIRATION transactions for expired allocations', async () => {
    prisma.creditTransaction.findMany.mockResolvedValue([
      { id: 'ct-1', studentId: 'stu-1', amount: 4, type: 'MONTHLY_ALLOCATION' },
      { id: 'ct-2', studentId: 'stu-2', amount: 8, type: 'MONTHLY_ALLOCATION' },
    ]);
    prisma.creditTransaction.create.mockResolvedValue({});

    await expireOldCredits();

    expect(prisma.creditTransaction.create).toHaveBeenCalledTimes(2);
    expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'stu-1',
          type: 'EXPIRATION',
          amount: -4,
        }),
      })
    );
    expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'stu-2',
          type: 'EXPIRATION',
          amount: -8,
        }),
      })
    );
  });

  it('should do nothing when no expired allocations exist', async () => {
    prisma.creditTransaction.findMany.mockResolvedValue([]);

    await expireOldCredits();

    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
  });

  it('should query for expired MONTHLY_ALLOCATION transactions', async () => {
    prisma.creditTransaction.findMany.mockResolvedValue([]);

    await expireOldCredits();

    expect(prisma.creditTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'MONTHLY_ALLOCATION',
          expiresAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      })
    );
  });
});
