import { refundSessionBookingById } from '@/lib/credits';
import { prisma } from '@/lib/prisma';

describe('refundSessionBookingById - idempotency and basic flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns NOT_CANCELLED when booking is not cancelled', async () => {
    // Arrange tx mocks inside $transaction
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        sessionBooking: { findUnique: jest.fn().mockResolvedValue({ id: 'sb1', status: 'SCHEDULED', studentId: 'user-stu' }) },
        creditTransaction: { findFirst: jest.fn() },
        student: { findFirst: jest.fn() },
      } as any;
      return cb(tx);
    });

    // Act
    const res = await refundSessionBookingById('sb1');

    // Assert
    expect(res).toEqual({ ok: false, reason: 'NOT_CANCELLED' });
    expect((prisma.$transaction as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  it('is idempotent if a refund already exists', async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        sessionBooking: { findUnique: jest.fn().mockResolvedValue({ id: 'sb2', status: 'CANCELLED', studentId: 'user-stu' }) },
        creditTransaction: { findFirst: jest.fn().mockResolvedValue({ id: 'tx1', type: 'REFUND' }) },
        student: { findFirst: jest.fn() },
      } as any;
      return cb(tx);
    });

    const res = await refundSessionBookingById('sb2');
    expect(res).toEqual({ ok: true, alreadyRefunded: true });
  });

  it('creates a refund when none exists', async () => {
    const createdTx = { id: 'tx-created', type: 'REFUND' };
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        sessionBooking: { findUnique: jest.fn().mockResolvedValue({ id: 'sb3', status: 'CANCELLED', studentId: 'user-stu', creditsUsed: 2, title: 'Cours' }) },
        creditTransaction: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(createdTx),
        },
        student: { findFirst: jest.fn().mockResolvedValue({ id: 'stu-entity' }) },
      } as any;
      return cb(tx);
    });

    const res = await refundSessionBookingById('sb3');
    expect(res).toEqual({ ok: true, transaction: createdTx });
  });

  it('treats serialization conflict as idempotent if refund exists after', async () => {
    // Make $transaction throw a P2034 error
    (prisma.$transaction as jest.Mock).mockImplementation(async () => {
      const err: any = new Error('Serialization failure');
      err.code = 'P2034';
      throw err;
    });

    // After conflict, the function queries prisma.creditTransaction.findFirst (root client)
    (prisma as any).creditTransaction.findFirst = jest.fn().mockResolvedValue({ id: 'tx-existing', type: 'REFUND' });

    const res = await refundSessionBookingById('sb4');
    expect(res).toEqual({ ok: true, alreadyRefunded: true });
    expect((prisma as any).creditTransaction.findFirst).toHaveBeenCalled();
  });
});
