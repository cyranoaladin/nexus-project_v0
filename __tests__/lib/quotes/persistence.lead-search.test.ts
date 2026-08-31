jest.mock('@/lib/prisma', () => ({
  prisma: { contactLead: { findMany: jest.fn() } },
}));

import { prisma } from '@/lib/prisma';
import { searchContactLeads } from '@/lib/quotes/persistence.server';

describe('quote lead search projection', () => {
  test.each([1, 3, 10])('selects only fields used by DevisWorkspace with take=%i', async (limit) => {
    const leads = Array.from({ length: limit }, (_, index) => ({
      id: `contact-lead-${index}`, name: `Responsable ${index}`, email: `lead${index}@example.test`, phone: null,
    }));
    (prisma.contactLead.findMany as jest.Mock).mockResolvedValue(leads);
    await expect(searchContactLeads('Sonia', limit)).resolves.toHaveLength(limit);
    expect(prisma.contactLead.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: { id: true, name: true, email: true, phone: true },
      take: limit,
    }));
  });

  test('defaults to ten without a hidden post-query truncation', async () => {
    const leads = Array.from({ length: 10 }, (_, index) => ({
      id: `contact-lead-${index}`, name: `Responsable ${index}`, email: `lead${index}@example.test`, phone: null,
    }));
    (prisma.contactLead.findMany as jest.Mock).mockResolvedValue(leads);
    await expect(searchContactLeads('Sonia')).resolves.toHaveLength(10);
    expect(prisma.contactLead.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });
});
