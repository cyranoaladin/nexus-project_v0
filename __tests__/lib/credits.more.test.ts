import { calculateCreditCost, checkCreditBalance, debitCredits, refundCredits, allocateMonthlyCredits, canCancelBooking } from '@/lib/credits';
import { prisma } from '@/lib/prisma';

describe('lib/credits additional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculateCreditCost returns defaults for unknown service types', () => {
    // @ts-expect-error testing default branch
    expect(calculateCreditCost('UNKNOWN')).toBe(1);
  });

  it('checkCreditBalance returns false when insufficient credits', async () => {
    (prisma as any).creditTransaction = (prisma as any).creditTransaction || {};
    (prisma as any).creditTransaction.findMany = jest.fn().mockResolvedValue([
      { amount: 1, expiresAt: null },
      { amount: -0.5, expiresAt: null },
    ]);
    const ok = await checkCreditBalance('student-1', 2);
    expect(ok).toBe(false);
  });

  it('checkCreditBalance returns true when sufficient credits with non-expired', async () => {
    (prisma as any).creditTransaction.findMany = jest.fn().mockResolvedValue([
      { amount: 1, expiresAt: null },
      { amount: 1.5, expiresAt: new Date(Date.now() + 86400000) },
    ]);
    const ok = await checkCreditBalance('student-1', 2);
    expect(ok).toBe(true);
  });

  it('debitCredits and refundCredits create transactions', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'tx1' });
    (prisma as any).creditTransaction.create = create;
    await debitCredits('s1', 1.25, 'sess1', 'Débit test');
    await refundCredits('s1', 1.25, 'sess1', 'Remboursement test');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('allocateMonthlyCredits sets expiration about two months in future', async () => {
    const create = jest.fn().mockImplementation(({ data }: any) => ({ id: 'tx2', ...data }));
    (prisma as any).creditTransaction.create = create;
    const res = await allocateMonthlyCredits('s1', 4);
    expect(res.type).toBe('MONTHLY_ALLOCATION');
    expect(res.amount).toBe(4);
    expect(new Date(res.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('canCancelBooking enforces 48h for ATELIER_GROUPE and 24h otherwise', () => {
    const now = Date.now();
    expect(
      canCancelBooking(new Date(now + 49 * 3600 * 1000), 'ATELIER_GROUPE' as any)
    ).toBe(true);
    expect(
      canCancelBooking(new Date(now + 47 * 3600 * 1000), 'ATELIER_GROUPE' as any)
    ).toBe(false);

    expect(
      canCancelBooking(new Date(now + 25 * 3600 * 1000), 'COURS_ONLINE' as any)
    ).toBe(true);
    expect(
      canCancelBooking(new Date(now + 23 * 3600 * 1000), 'COURS_ONLINE' as any)
    ).toBe(false);
  });
});
