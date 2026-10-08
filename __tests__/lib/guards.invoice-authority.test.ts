/** @jest-environment node */
import { requireParentOwnsInvoice } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
jest.mock('@/auth', () => ({ auth: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(prisma.invoice.findUnique).mockResolvedValue({ beneficiaryUserId: 'synthetic-child' } as never);
  jest.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ children: [{ id: 'synthetic-child' }] } as never);
  jest.mocked(prisma.invoice.findFirst).mockResolvedValue(null);
});

test('a family relationship alone grants no invoice access', async () => {
  const result = await requireParentOwnsInvoice('synthetic-parent', 'synthetic-invoice');
  expect(result).not.toBe(true);
  if (result === true) throw new Error('Unexpected family-only invoice access');
  expect(result.status).toBe(403);
  expect(prisma.parentProfile.findUnique).not.toHaveBeenCalled();
});

test('queries canonical payer/delegation scope and excludes DRAFT before reading', async () => {
  jest.mocked(prisma.invoice.findFirst).mockResolvedValue({ id: 'synthetic-invoice' } as never);
  await expect(requireParentOwnsInvoice('synthetic-parent', 'synthetic-invoice')).resolves.toBe(true);
  expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
    where: { id: 'synthetic-invoice', AND: [{ OR: [
      { status: { in: ['SENT', 'PAID'] } },
      { status: 'CANCELLED', events: { array_contains: [{ type: 'INVOICE_SENT' }] } },
    ] }], OR: [
      { payerUserId: 'synthetic-parent' },
      { financialDelegations: { some: {
        delegateUserId: 'synthetic-parent', revokedAt: null,
        startsAt: { lte: expect.any(Date) }, expiresAt: { gt: expect.any(Date) },
      } } },
    ] }, select: { id: true },
  });
  expect(prisma.invoice.findUnique).not.toHaveBeenCalled();
});

test('denies an empty actor before accessing invoice data', async () => {
  const result = await requireParentOwnsInvoice('', 'synthetic-invoice');
  expect(result).not.toBe(true);
  expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
});
