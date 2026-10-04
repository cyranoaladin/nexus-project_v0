import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/admin/invoices/route';
import { renderInvoicePDF } from '@/lib/invoice';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/invoice', () => ({
  ...jest.requireActual('@/lib/invoice/types'),
  InvoiceOverflowError: jest.requireActual('@/lib/invoice/pdf').InvoiceOverflowError,
  generateInvoiceNumber: jest.fn().mockResolvedValue('SYNTHETIC-CREATE'),
  renderInvoicePDF: jest.fn().mockResolvedValue(Buffer.from('synthetic-pdf')),
  storeInvoicePDF: jest.fn().mockResolvedValue('synthetic-storage-key'),
  getInvoiceUrl: jest.fn().mockReturnValue('/api/invoices/synthetic-invoice/pdf'),
  assertMillimes: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'synthetic-admin', role: 'ADMIN' } });
  (prisma.invoice.create as jest.Mock).mockResolvedValue({
    id: 'synthetic-invoice', number: 'SYNTHETIC-CREATE', issuedAt: new Date('2026-10-04T00:00:00Z'), dueAt: null,
    issuerName: 'Synthetic issuer', issuerAddress: 'Synthetic fixture', issuerMF: 'SYNTHETIC', issuerRNE: null,
    customerName: 'Synthetic fixture', customerEmail: null, customerAddress: null, customerId: null,
    currency: 'TND', subtotal: 1000, discountTotal: 0, taxTotal: 0, total: 1000,
    taxRegime: 'TVA_NON_APPLICABLE', events: [], items: [{ label: 'Synthetic fixture', qty: 1, unitPrice: 1000, total: 1000 }],
  });
  (prisma.invoiceFinancialAccessAudit.create as jest.Mock).mockResolvedValue({ id: 'synthetic-audit' });
});
function request() {
  return POST(new NextRequest('https://nexusreussite.academy/api/admin/invoices', {
    method: 'POST', body: JSON.stringify({ customer: { name: 'Synthetic fixture' },
      items: [{ label: 'Synthetic fixture', qty: 1, unitPrice: 1000 }] }),
  }));
}
it('commits creation evidence with the invoice before preparing a PDF', async () => {
  expect((await request()).status).toBe(201);
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(prisma.invoiceFinancialAccessAudit.create).toHaveBeenCalledWith({ data: expect.objectContaining({
    invoiceId: 'synthetic-invoice', actorUserId: 'synthetic-admin', action: 'INVOICE_CREATED',
    requestKey: expect.stringMatching(/^invoice-create:/),
  }) });
  const auditOrder = (prisma.invoiceFinancialAccessAudit.create as jest.Mock).mock.invocationCallOrder[0];
  expect(auditOrder).toBeLessThan((renderInvoicePDF as jest.Mock).mock.invocationCallOrder[0]);
});
it('does not prepare or expose a PDF when creation evidence fails', async () => {
  (prisma.invoiceFinancialAccessAudit.create as jest.Mock).mockRejectedValue(new Error('SYNTHETIC_AUDIT_UNAVAILABLE'));
  const logger = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try { expect((await request()).status).toBe(500); }
  finally { logger.mockRestore(); }
  expect(renderInvoicePDF).not.toHaveBeenCalled();
});
