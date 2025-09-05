import { upsertPaymentByExternalId } from '@/lib/payments';
import { prisma } from '@/lib/prisma';

describe('upsertPaymentByExternalId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates when none exists', async () => {
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'p1', externalId: 'ext1', method: 'konnect' });

    const res = await upsertPaymentByExternalId({
      externalId: 'ext1', method: 'konnect', type: 'CREDIT_PACK', userId: 'u1', amount: 10, description: 'desc'
    });

    expect(res.created).toBe(true);
    expect(prisma.payment.create).toHaveBeenCalled();
  });

  it('returns existing when found', async () => {
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue({ id: 'p2', externalId: 'ext2', method: 'konnect' });

    const res = await upsertPaymentByExternalId({
      externalId: 'ext2', method: 'konnect', type: 'CREDIT_PACK', userId: 'u1', amount: 10, description: 'desc'
    });

    expect(res.created).toBe(false);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('handles unique violation by returning existing', async () => {
    (prisma.payment.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'p3', externalId: 'ext3', method: 'konnect' });

    const err: any = new Error('Unique constraint failed');
    err.code = 'P2002';
    (prisma.payment.create as jest.Mock).mockRejectedValueOnce(err);

    const res = await upsertPaymentByExternalId({
      externalId: 'ext3', method: 'konnect', type: 'CREDIT_PACK', userId: 'u1', amount: 10, description: 'desc'
    });

    expect(res.created).toBe(false);
    expect(res.payment.id).toBe('p3');
  });
});

