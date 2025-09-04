import { ensureWallet, spendCredits } from '@/lib/credits';
import { prisma } from '@/lib/prisma';

describe('lib/credits - wallet and spendCredits', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('ensureWallet creates wallet when missing', async () => {
    (prisma as any).creditWallet = (prisma as any).creditWallet || {};
    (prisma as any).creditWallet.findUnique = jest.fn().mockResolvedValue(null);
    (prisma as any).creditWallet.create = jest.fn().mockResolvedValue({ id: 'w1', userId: 'u1', balance: 0 });
    const w = await ensureWallet('u1');
    expect(w.id).toBe('w1');
    expect((prisma as any).creditWallet.create).toHaveBeenCalled();
  });

  it('spendCredits returns already=true when duplicate externalId', async () => {
    (prisma as any).creditWallet = (prisma as any).creditWallet || {};
    (prisma as any).creditTx = (prisma as any).creditTx || {};
    (prisma as any).creditWallet.findUnique = jest.fn()
      // first call from ensureWallet
      .mockResolvedValueOnce({ id: 'w1', userId: 'u1', balance: 10 })
      // second call for balance fetch on dup path
      .mockResolvedValueOnce({ id: 'w1', userId: 'u1', balance: 7 });
    (prisma as any).creditTx.findFirst = jest.fn().mockResolvedValue({ id: 'tx-dup' });

    const out = await spendCredits({ userId: 'u1', credits: 3, reason: 'test', externalId: 'ext-1' });
    expect(out.already).toBe(true);
    expect(out.balance).toBe(7);
  });

  it('spendCredits throws INSUFFICIENT_CREDITS via $transaction', async () => {
    (prisma as any).creditWallet = (prisma as any).creditWallet || {};
    (prisma as any).creditTx = (prisma as any).creditTx || {};
    (prisma as any).creditWallet.findUnique = jest.fn().mockResolvedValue({ id: 'w1', userId: 'u1', balance: 2 });
    (prisma as any).creditTx.findFirst = jest.fn().mockResolvedValue(null);

    const tx = {
      creditWallet: { findUnique: jest.fn().mockResolvedValue({ id: 'w1', balance: 2 }) },
      creditTx: { create: jest.fn() },
    } as any;
    (prisma as any).$transaction = async (fn: any) => fn(tx);

    await expect(spendCredits({ userId: 'u1', credits: 5, reason: 'need more' })).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
  });

  it('spendCredits decrements wallet and records tx on success', async () => {
    (prisma as any).creditWallet = (prisma as any).creditWallet || {};
    (prisma as any).creditTx = (prisma as any).creditTx || {};
    (prisma as any).creditWallet.findUnique = jest.fn().mockResolvedValue({ id: 'w1', userId: 'u1', balance: 10 });
    (prisma as any).creditTx.findFirst = jest.fn().mockResolvedValue(null);

    const tx = {
      creditWallet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'w1', balance: 10 }),
        update: jest.fn().mockResolvedValue({ id: 'w1', balance: 5 }),
      },
      creditTx: { create: jest.fn().mockResolvedValue({ id: 'tx1' }) },
    } as any;
    (prisma as any).$transaction = async (fn: any) => fn(tx);

    const out = await spendCredits({ userId: 'u1', credits: 5, reason: 'ok' });
    expect(out.balance).toBe(5);
    expect(tx.creditWallet.update).toHaveBeenCalled();
    expect(tx.creditTx.create).toHaveBeenCalled();
  });
});
