import { expireOldCredits } from '@/lib/credits';
import { prisma } from '@/lib/prisma';

describe('lib/credits - expireOldCredits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).creditTransaction = (prisma as any).creditTransaction || {};
  });

  it('creates EXPIRATION transactions for each expired MONTHLY_ALLOCATION', async () => {
    const expired = [
      { studentId: 's1', amount: 3 },
      { studentId: 's2', amount: 2.5 },
    ];
    (prisma as any).creditTransaction.findMany = jest.fn().mockResolvedValue(expired);
    const create = jest.fn().mockResolvedValue({ id: 'newtx' });
    (prisma as any).creditTransaction.create = create;

    await expireOldCredits();

    expect((prisma as any).creditTransaction.findMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) }, type: 'MONTHLY_ALLOCATION' },
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenNthCalledWith(1, {
      data: {
        studentId: 's1',
        type: 'EXPIRATION',
        amount: -3,
        description: 'Expiration de 3 crédits reportés',
      },
    });
    expect(create).toHaveBeenNthCalledWith(2, {
      data: {
        studentId: 's2',
        type: 'EXPIRATION',
        amount: -2.5,
        description: 'Expiration de 2.5 crédits reportés',
      },
    });
  });

  it('does nothing when no expired transactions', async () => {
    (prisma as any).creditTransaction.findMany = jest.fn().mockResolvedValue([]);
    const create = jest.fn();
    (prisma as any).creditTransaction.create = create;

    await expireOldCredits();

    expect(create).not.toHaveBeenCalled();
  });
});
