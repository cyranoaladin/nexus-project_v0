import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import ParentInvoicesPage from '@/app/dashboard/parent/factures/page';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { parentProfile: { findUnique: jest.fn() }, invoice: { findMany: jest.fn() } } }));
jest.mock('next/navigation', () => ({ redirect: jest.fn(() => { throw new Error('redirect'); }) }));
beforeEach(() => { jest.clearAllMocks(); (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]); });
it('lists phone-only parent invoices only through owned child beneficiaries', async () => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'parent1', role: 'PARENT', email: null } });
  (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ children: [{ userId: 'child1' }] });
  await ParentInvoicesPage();
  expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ beneficiaryUserId: { in: ['child1'] } }] } }));
});
it('never searches empty customer email when no ownership scope exists', async () => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'parent1', role: 'PARENT', email: null } });
  (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ children: [] });
  await ParentInvoicesPage();
  expect(prisma.invoice.findMany).not.toHaveBeenCalled();
});
