/** @jest-environment node */
import { GET as invoicePDF } from '@/app/api/invoices/[id]/pdf/route';
import { GET as receiptPDF } from '@/app/api/invoices/[id]/receipt/pdf/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { readInvoicePDF, renderReceiptPDF, createInvoiceEvent, appendInvoiceEvent } from '@/lib/invoice';
import { NextRequest } from 'next/server';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/invoice', () => ({
  readInvoicePDF: jest.fn(), renderReceiptPDF: jest.fn(),
  createInvoiceEvent: jest.fn(), appendInvoiceEvent: jest.fn(), verifyAccessToken: jest.fn(),
}));
const params = { params: Promise.resolve({ id: 'synthetic-invoice' }) };
const request = new NextRequest('http://localhost/api/invoices/synthetic-invoice/pdf');
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-parent', role: 'PARENT' } } as never);
  (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
    id: 'synthetic-invoice', number: 'SYNTHETIC-1', status: 'PAID', pdfPath: '/synthetic/invoice.pdf',
    issuedAt: new Date('2026-10-01T00:00:00Z'), paidAt: new Date('2026-10-02T00:00:00Z'),
    paidAmount: 1000, total: 1000, currency: 'TND', events: [],
  });
  jest.mocked(readInvoicePDF).mockResolvedValue(Buffer.from('synthetic-pdf'));
  jest.mocked(renderReceiptPDF).mockResolvedValue(Buffer.from('synthetic-receipt'));
  (prisma.invoiceFinancialAccessAudit.create as jest.Mock).mockResolvedValue({ id: 'synthetic-audit' });
  (prisma.invoice.update as jest.Mock).mockResolvedValue({});
  jest.mocked(createInvoiceEvent).mockReturnValue({type:'RECEIPT_RENDERED',at:'2026-10-04T12:00:00Z',by:'synthetic-parent'} as never);
  jest.mocked(appendInvoiceEvent).mockReturnValue([]);
});

it.each([[invoicePDF,'PDF_READ'],[receiptPDF,'RECEIPT_READ']] as const)(
  'records a dedicated append-only %s access before returning private PDF', async (get,action) => {
    const response = await get(request,params);
    expect(response.status).toBe(200);
    expect(prisma.invoiceFinancialAccessAudit.create).toHaveBeenCalledWith({data:{
      invoiceId:'synthetic-invoice',actorUserId:'synthetic-parent',action,
      requestKey:expect.stringMatching(/^invoice-access:[a-f0-9-]{36}$/),
    }});
    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  },
);
it.each([invoicePDF,receiptPDF])('returns no PDF when mandatory access audit fails', async get => {
  (prisma.invoiceFinancialAccessAudit.create as jest.Mock).mockRejectedValue(new Error('SYNTHETIC_AUDIT_UNAVAILABLE'));
  const response = await get(request,params);
  expect(response.status).toBe(404);
  expect(response.headers.get('Content-Type')).not.toBe('application/pdf');
});
it.each([invoicePDF,receiptPDF])('records no successful read when artifact preparation fails', async get => {
  jest.mocked(readInvoicePDF).mockRejectedValue(new Error('SYNTHETIC_STORAGE_UNAVAILABLE'));
  jest.mocked(renderReceiptPDF).mockRejectedValue(new Error('SYNTHETIC_RENDER_UNAVAILABLE'));
  const response = await get(request,params);
  expect(response.status).toBe(404);
  expect(prisma.invoiceFinancialAccessAudit.create).not.toHaveBeenCalled();
});


it.each([invoicePDF,receiptPDF])('does not return the prepared body before audit persistence completes', async get => {
  let release!: () => void;
  let entered!: () => void;
  const auditEntered = new Promise<void>(resolve => { entered = resolve; });
  const persisted = new Promise<void>(resolve => { release = resolve; });
  (prisma.invoiceFinancialAccessAudit.create as jest.Mock).mockImplementation(() => {
    entered(); return persisted.then(() => ({ id: 'synthetic-audit' }));
  });
  let responded = false;
  const response = get(request,params).then(value => { responded = true; return value; });
  await auditEntered;
  expect(responded).toBe(false);
  release();
  expect((await response).status).toBe(200);
});

it.each([invoicePDF,receiptPDF])('keeps simultaneous prepared reads as distinct audit entries', async get => {
  const responses = await Promise.all([get(request,params),get(request,params)]);
  expect(responses.map(r => r.status)).toEqual([200,200]);
  const calls = jest.mocked(prisma.invoiceFinancialAccessAudit.create).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[0][0].data.requestKey).not.toBe(calls[1][0].data.requestKey);
  expect(prisma.invoice.update).not.toHaveBeenCalled();
});

it.each([invoicePDF,receiptPDF])('never records a successful read for an out-of-scope invoice', async get => {
  (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);
  expect((await get(request,params)).status).toBe(404);
  expect(prisma.invoiceFinancialAccessAudit.create).not.toHaveBeenCalled();
});
