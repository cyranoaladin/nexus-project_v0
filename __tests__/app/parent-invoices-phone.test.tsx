import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import ParentInvoicesPage from '@/app/dashboard/parent/factures/page';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { parentProfile: { findUnique: jest.fn() }, invoice: { findMany: jest.fn() } } }));
jest.mock('next/navigation', () => ({ redirect: jest.fn(() => { throw new Error('redirect'); }) }));
beforeEach(() => { jest.clearAllMocks(); (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]); });
it.each([true, false])('phone-only parent uses payer/delegation scope independently of family membership=%s', async hasChild => {
  const now = new Date('2026-10-04T12:00:00Z');
  jest.useFakeTimers().setSystemTime(now);
  try {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'parent1', role: 'PARENT', email: null } });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ children: hasChild ? [{ userId: 'child1' }] : [] });
    await ParentInvoicesPage();
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      status: { not: 'DRAFT' },
      OR: [
        { payerUserId: 'parent1' },
        { financialDelegations: { some: {
          delegateUserId: 'parent1', revokedAt: null,
          startsAt: { lte: now }, expiresAt: { gt: now },
        } } },
      ],
    } }));
    expect(prisma.parentProfile.findUnique).not.toHaveBeenCalled();
    const query = JSON.stringify((prisma.invoice.findMany as jest.Mock).mock.calls);
    expect(query).not.toContain('customerEmail');
    expect(query).not.toContain('beneficiaryUserId');
    expect(query).not.toContain('child1');
  } finally {
    jest.useRealTimers();
  }
});
it('missing canonical session identity never queries invoices', async () => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: '', role: 'PARENT', email: null } });
  await ParentInvoicesPage();
  expect(prisma.invoice.findMany).not.toHaveBeenCalled();
});
