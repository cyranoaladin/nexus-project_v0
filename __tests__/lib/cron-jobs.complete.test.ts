/**
 * Cron Jobs — Complete Test Suite
 *
 * Tests: checkExpiringCredits, expireOldCredits, allocateMonthlyCredits
 *
 * Source: lib/cron-jobs.ts
 */

jest.mock('@/lib/email', () => ({
  sendCreditExpirationReminder: jest.fn().mockResolvedValue(undefined),
}));

import { checkExpiringCredits, expireOldCredits, allocateMonthlyCredits } from '@/lib/cron-jobs';
import { sendCreditExpirationReminder } from '@/lib/email';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

// ─── checkExpiringCredits ────────────────────────────────────────────────────

describe('checkExpiringCredits', () => {
  it('should find expiring credits and send reminders', async () => {
    prisma.creditTransaction.findMany.mockResolvedValue([
      {
        studentId: 'stu-1',
        amount: 3,
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        student: {
          user: { firstName: 'Ahmed', lastName: 'Ben Ali' },
          parent: {
            user: { email: 'parent@test.com', firstName: 'Karim', lastName: 'Ben Ali' },
          },
        },
      },
    ]);

    await checkExpiringCredits();

    expect(sendCreditExpirationReminder).toHaveBeenCalledTimes(1);
    expect(sendCreditExpirationReminder).toHaveBeenCalledWith(
      'parent@test.com',
      'Karim Ben Ali',
      'Ahmed Ben Ali',
      3,
      expect.any(Date)
    );
  });

  it('should handle no expiring credits gracefully', async () => {
    prisma.creditTransaction.findMany.mockResolvedValue([]);

    await checkExpiringCredits();

    expect(sendCreditExpirationReminder).not.toHaveBeenCalled();
  });

  it('should group credits by student', async () => {
    prisma.creditTransaction.findMany.mockResolvedValue([
      {
        studentId: 'stu-1',
        amount: 2,
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        student: {
          user: { firstName: 'Ahmed', lastName: 'Ben Ali' },
          parent: {
            user: { email: 'parent@test.com', firstName: 'Karim', lastName: 'Ben Ali' },
          },
        },
      },
      {
        studentId: 'stu-1',
        amount: 1,
        expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        student: {
          user: { firstName: 'Ahmed', lastName: 'Ben Ali' },
          parent: {
            user: { email: 'parent@test.com', firstName: 'Karim', lastName: 'Ben Ali' },
          },
        },
      },
    ]);

    await checkExpiringCredits();

    // Should send 1 email (grouped by student), total 3 credits
    expect(sendCreditExpirationReminder).toHaveBeenCalledTimes(1);
    expect(sendCreditExpirationReminder).toHaveBeenCalledWith(
      'parent@test.com',
      'Karim Ben Ali',
      'Ahmed Ben Ali',
      3,
      expect.any(Date)
    );
  });

  it('should not throw when email sending fails', async () => {
    prisma.creditTransaction.findMany.mockResolvedValue([
      {
        studentId: 'stu-1',
        amount: 2,
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        student: {
          user: { firstName: 'Ahmed', lastName: 'Ben Ali' },
          parent: {
            user: { email: 'parent@test.com', firstName: 'Karim', lastName: 'Ben Ali' },
          },
        },
      },
    ]);
    (sendCreditExpirationReminder as jest.Mock).mockRejectedValueOnce(new Error('SMTP error'));

    await expect(checkExpiringCredits()).resolves.toBeUndefined();
  });
});

// ─── expireOldCredits ────────────────────────────────────────────────────────

describe('expireOldCredits', () => {
  it('should expire old credits in a transaction', async () => {
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        creditTransaction: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'ct-1', studentId: 'stu-1', amount: 3 },
            { id: 'ct-2', studentId: 'stu-2', amount: 2 },
          ]),
          create: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });

    await expireOldCredits();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should handle no expired credits', async () => {
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        creditTransaction: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn(),
          update: jest.fn(),
        },
      };
      return fn(tx);
    });

    await expireOldCredits();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

// ─── allocateMonthlyCredits ──────────────────────────────────────────────────

describe('allocateMonthlyCredits', () => {
  it('should skip if already executed this month', async () => {
    prisma.cronExecution.create.mockRejectedValue({ code: 'P2002' });

    await allocateMonthlyCredits();

    // Should not call $transaction since execution was skipped
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should allocate credits for active subscriptions', async () => {
    prisma.cronExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.cronExecution.update.mockResolvedValue({});

    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        subscription: {
          findMany: jest.fn().mockResolvedValue([
            {
              studentId: 'stu-1',
              creditsPerMonth: 4,
              student: { user: { firstName: 'Ahmed' } },
            },
          ]),
        },
        creditTransaction: {
          create: jest.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });

    await allocateMonthlyCredits();

    expect(prisma.cronExecution.create).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // completeExecution should be called
    expect(prisma.cronExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exec-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
        }),
      })
    );
  });

  it('should mark execution as FAILED on error', async () => {
    prisma.cronExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.cronExecution.update.mockResolvedValue({});
    prisma.$transaction.mockRejectedValue(new Error('DB timeout'));

    await expect(allocateMonthlyCredits()).rejects.toThrow('DB timeout');

    expect(prisma.cronExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exec-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'DB timeout',
        }),
      })
    );
  });

  it('should use year-month as execution key', async () => {
    prisma.cronExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.cronExecution.update.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        subscription: { findMany: jest.fn().mockResolvedValue([]) },
        creditTransaction: { create: jest.fn() },
      };
      return fn(tx);
    });

    await allocateMonthlyCredits();

    const now = new Date();
    const expectedKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(prisma.cronExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobName: 'monthly-allocation',
          executionKey: expectedKey,
        }),
      })
    );
  });
});
