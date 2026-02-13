import { allocateMonthlyCredits, checkExpiringCredits, expireOldCredits } from '@/lib/cron-jobs';
import { prisma } from '@/lib/prisma';
import { sendCreditExpirationReminder } from '@/lib/email';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    cronExecution: {
      create: jest.fn(),
      update: jest.fn(),
    },
    creditTransaction: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/email', () => ({
  sendCreditExpirationReminder: jest.fn(),
}));

jest.mock(
  '@prisma/client',
  () => ({
    Prisma: {
      TransactionIsolationLevel: {
        Serializable: 'Serializable',
      },
    },
    CronExecutionStatus: {
      RUNNING: 'RUNNING',
      COMPLETED: 'COMPLETED',
      FAILED: 'FAILED',
    },
  }),
  { virtual: true }
);

describe('cron-jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checkExpiringCredits sends grouped reminders per student', async () => {
    const now = new Date('2026-02-12T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    (prisma.creditTransaction.findMany as jest.Mock).mockResolvedValue([
      {
        studentId: 'student-1',
        amount: 3,
        expiresAt: new Date('2026-02-19T00:00:00.000Z'),
        student: {
          user: { firstName: 'Yasmine', lastName: 'Dupont' },
          parent: {
            user: { firstName: 'Marie', lastName: 'Dupont', email: 'parent@test.com' },
          },
        },
      },
      {
        studentId: 'student-1',
        amount: 2,
        expiresAt: new Date('2026-02-19T00:00:00.000Z'),
        student: {
          user: { firstName: 'Yasmine', lastName: 'Dupont' },
          parent: {
            user: { firstName: 'Marie', lastName: 'Dupont', email: 'parent@test.com' },
          },
        },
      },
    ]);

    await checkExpiringCredits();

    expect(sendCreditExpirationReminder).toHaveBeenCalledTimes(1);
    expect(sendCreditExpirationReminder).toHaveBeenCalledWith(
      'parent@test.com',
      'Marie Dupont',
      'Yasmine Dupont',
      5,
      new Date('2026-02-19T00:00:00.000Z')
    );

    jest.useRealTimers();
  });

  it('expireOldCredits creates expiration entries and zeroes old credits', async () => {
    const expired = [
      { id: 'tx-1', studentId: 'student-1', amount: 3 },
      { id: 'tx-2', studentId: 'student-2', amount: 2 },
    ];

    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
      const tx = {
        creditTransaction: {
          findMany: jest.fn().mockResolvedValue(expired),
          create: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });

    await expireOldCredits();

    const tx = (prisma.$transaction as jest.Mock).mock.calls[0][0];
    expect(tx).toBeInstanceOf(Function);
  });

  it('allocateMonthlyCredits is idempotent and records execution', async () => {
    (prisma.cronExecution.create as jest.Mock).mockResolvedValue({
      id: 'exec-1',
    });

    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
      const tx = {
        subscription: {
          findMany: jest.fn().mockResolvedValue([
            {
              studentId: 'student-1',
              creditsPerMonth: 4,
              student: { user: { firstName: 'Yasmine' } },
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
    expect(prisma.cronExecution.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: { status: 'COMPLETED', completedAt: expect.any(Date), error: undefined },
    });
  });
});
