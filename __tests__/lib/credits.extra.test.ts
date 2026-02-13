const prismaMock = {
  creditTransaction: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  sessionBooking: {
    findUnique: jest.fn(),
  },
  student: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

jest.mock(
  '@prisma/client',
  () => ({
    Prisma: {
      TransactionIsolationLevel: {
        Serializable: 'Serializable',
      },
    },
  }),
  { virtual: true }
);

import {
  allocateMonthlyCredits,
  canCancelBooking,
  checkCreditBalance,
  refundSessionBookingById,
} from '@/lib/credits';

describe('credits extra', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checkCreditBalance sums non-expired credits', async () => {
    prismaMock.creditTransaction.findMany.mockResolvedValue([
      { amount: 2 },
      { amount: -1 },
    ]);
    const result = await checkCreditBalance('student-1', 1);
    expect(result).toBe(true);
  });

  it('allocateMonthlyCredits creates transaction with future expiry', async () => {
    prismaMock.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });
    const res = await allocateMonthlyCredits('student-1', 4);
    expect(res).toEqual({ id: 'tx-1' });
  });

  it('refundSessionBookingById returns not cancelled when status differs', async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      return fn({
        sessionBooking: {
          findUnique: jest.fn().mockResolvedValue({ status: 'SCHEDULED' }),
        },
        creditTransaction: {
          findFirst: jest.fn(),
        },
        student: {
          findFirst: jest.fn(),
        },
      });
    });

    const res = await refundSessionBookingById('booking-1');
    expect(res).toEqual({ ok: false, reason: 'NOT_CANCELLED' });
  });

  it('canCancelBooking respects policy', () => {
    const now = new Date('2026-02-12T10:00:00Z');
    const in25h = new Date('2026-02-13T11:00:00Z');
    const in30h = new Date('2026-02-13T16:00:00Z');
    const in60h = new Date('2026-02-14T22:00:00Z');

    expect(canCancelBooking('INDIVIDUAL' as any, 'ONLINE' as any, in25h, now)).toBe(true);
    expect(canCancelBooking('GROUP' as any, 'IN_PERSON' as any, in30h, now)).toBe(false);
    expect(canCancelBooking('GROUP' as any, 'IN_PERSON' as any, in60h, now)).toBe(true);
  });
});
