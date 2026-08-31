jest.mock('@/lib/prisma', () => ({
  prisma: { contactLead: { findMany: jest.fn() } },
}));

import { prisma } from '@/lib/prisma';
import { searchContactLeads } from '@/lib/quotes/persistence.server';

describe('quote lead search projection', () => {
  test('selects only fields used by DevisWorkspace', async () => {
    (prisma.contactLead.findMany as jest.Mock).mockResolvedValue([]);
    await searchContactLeads('Sonia');
    expect(prisma.contactLead.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: { id: true, name: true, email: true, phone: true },
    }));
  });
});
