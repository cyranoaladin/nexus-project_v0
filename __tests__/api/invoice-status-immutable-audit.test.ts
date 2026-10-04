import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PATCH } from '@/app/api/admin/invoices/[id]/route';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/invoice', () => ({
  ...jest.requireActual('@/lib/invoice/transitions'), ...jest.requireActual('@/lib/invoice/types'),
}));
jest.mock('@/lib/entitlement', () => ({
  activateEntitlements: jest.fn().mockResolvedValue({ created: 0, extended: 0, creditsGranted: 0,
    activatedCodes: [], noBeneficiary: false, skippedItems: 0 }),
  suspendEntitlements: jest.fn().mockResolvedValue({ suspended: 0, suspendedCodes: [] }),
  isCanonicalAriaAccessUniquenessConflict: jest.fn().mockReturnValue(false),
}));
beforeEach(() => {
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic-admin', role: 'ADMIN' } });
  (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({ id: 'synthetic-invoice', status: 'SENT', total: 1000, events: [] });
  (prisma.invoice.update as jest.Mock).mockResolvedValue({ id: 'synthetic-invoice' });
  (prisma.invoiceAccessToken.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
  (prisma.invoiceFinancialAccessAudit.create as jest.Mock).mockResolvedValue({ id: 'synthetic-audit' });
});
function request(action: 'MARK_SENT' | 'MARK_PAID' | 'CANCEL') {
  return PATCH(new NextRequest('https://nexusreussite.academy/api/admin/invoices/synthetic-invoice', {
    method: 'PATCH', body: JSON.stringify({ action, ...(action === 'MARK_PAID'
      ? { meta: { payment: { method: 'CASH', amountPaid: 1000 } } } : {}) }),
  }), { params: Promise.resolve({ id: 'synthetic-invoice' }) });
}
it.each(['MARK_SENT', 'MARK_PAID', 'CANCEL'] as const)('records immutable %s evidence in the status transaction', async action => {
  if (action === 'MARK_SENT') (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({ id: 'synthetic-invoice', status: 'DRAFT', total: 1000, events: [] });
  expect((await request(action)).status).toBe(200);
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(prisma.invoiceFinancialAccessAudit.create).toHaveBeenCalledWith({ data: expect.objectContaining({
    invoiceId: 'synthetic-invoice', actorUserId: 'synthetic-admin',
    action: action === 'MARK_SENT' ? 'INVOICE_SENT' : action === 'MARK_PAID' ? 'INVOICE_PAID' : 'INVOICE_CANCELLED',
    requestKey: expect.stringMatching(/^invoice-status:/),
  }) });
});
it('does not report success if immutable evidence cannot be written', async () => {
  (prisma.invoiceFinancialAccessAudit.create as jest.Mock).mockRejectedValue(new Error('SYNTHETIC_AUDIT_UNAVAILABLE'));
  const logger = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try { expect((await request('CANCEL')).status).toBe(500); }
  finally { logger.mockRestore(); }
});
