import { NextRequest } from 'next/server';
const mockAuth = jest.fn();
const mockReadPdf = jest.fn();
const mockVerify = jest.fn();
const mockReceipt = jest.fn();
const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue({});
const mockAppendAudit = jest.fn();
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));
jest.mock('@/lib/prisma', () => ({ prisma: {
  invoice: { findUnique: (...args: unknown[]) => mockFindUnique(...args), findFirst: (...args: unknown[]) => mockFindFirst(...args), update: (...args: unknown[]) => mockUpdate(...args) },
  invoiceFinancialAccessAudit: { create: (...args: unknown[]) => mockAppendAudit(...args) },
  parentProfile: { findUnique: jest.fn().mockResolvedValue({ children: [] }) },
  user: { findUnique: jest.fn().mockResolvedValue({ email: 'synthetic@synthetic.test', parentPhoneState: 'NONE', emailVerifiedAt: new Date(), parentPhoneChallenges: [] }) },
} }));
jest.mock('@/lib/invoice', () => ({
  readInvoicePDF: (...args: unknown[]) => mockReadPdf(...args),
  verifyAccessToken: (...args: unknown[]) => mockVerify(...args),
  renderReceiptPDF: (...args: unknown[]) => mockReceipt(...args),
  createInvoiceEvent: jest.fn(), appendInvoiceEvent: jest.fn().mockReturnValue([]),
}));
import { GET } from '@/app/api/invoices/[id]/pdf/route';
import { GET as receipt } from '@/app/api/invoices/[id]/receipt/pdf/route';

function request(token = false) {
  return new NextRequest(`http://localhost/api/invoices/synthetic-invoice/pdf${token ? '?token=synthetic-fixture-token' : ''}`);
}
const params = { params: Promise.resolve({ id: 'synthetic-invoice' }) };
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'synthetic-parent', role: 'PARENT', email: 'synthetic@synthetic.test' } });
  mockVerify.mockResolvedValue({ valid: true, invoiceId: 'synthetic-invoice' });
  mockReadPdf.mockResolvedValue(Buffer.from('%PDF-synthetic'));
  mockUpdate.mockResolvedValue({});
  mockAppendAudit.mockResolvedValue({ id: 'synthetic-audit' });
  mockFindFirst.mockReset();
});

test.each(['invoice', 'receipt'])('unexpected %s read failures cannot log private exception details', async route => {
  const privateCanary = 'SYNTHETIC-PRIVATE-INVOICE-CANARY';
  const failure = new Error(privateCanary);
  failure.stack = privateCanary;
  const logging = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    mockFindFirst.mockRejectedValueOnce(failure);
    const response = await (route === 'invoice' ? GET : receipt)(request(), params);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
    expect(logging).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logging.mock.calls)).not.toContain(privateCanary);
    expect(logging).toHaveBeenCalledWith(route === 'invoice' ? 'INVOICE_PDF_READ_FAILED' : 'INVOICE_RECEIPT_READ_FAILED');
  } finally {
    logging.mockRestore();
  }
});

test.each([false, true])('DRAFT cannot be downloaded through token path=%s', async token => {
  const invoice = { id: 'synthetic-invoice', number: 'SYNTHETIC', pdfPath: 'synthetic.pdf', status: 'DRAFT' };
  mockFindUnique.mockResolvedValue(invoice); mockFindFirst.mockResolvedValue(invoice);
  const response = await GET(request(token), params);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
  expect(mockReadPdf).not.toHaveBeenCalled();
});

const sentEvidence = [{ type: 'INVOICE_SENT' }, { type: 'INVOICE_CANCELLED' }];
const neverSent = [{ type: 'INVOICE_CREATED' }, { type: 'PDF_RENDERED' }, { type: 'INVOICE_CANCELLED' }];

test.each([['SENT', []], ['PAID', []], ['CANCELLED', sentEvidence]])('published %s can be read but cannot be cached or leak token referrers', async (status, events) => {
  mockFindFirst.mockResolvedValue({ id: 'synthetic-invoice', number: 'SYNTHETIC', pdfPath: 'synthetic.pdf', status, events });
  const response = await GET(request(true), params);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
});

test.each([false, true])('a draft cancelled before any send stays private token path=%s', async token => {
  mockFindFirst.mockResolvedValue({ id: 'synthetic-invoice', number: 'SYNTHETIC', pdfPath: 'synthetic.pdf', status: 'CANCELLED', events: neverSent });
  const response = await GET(request(token), params);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
  expect(mockReadPdf).not.toHaveBeenCalled();
  expect(mockFindFirst).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ events: true }) }));
});

test('a parent cannot turn a cancelled draft receipt lookup into a financial status disclosure', async () => {
  mockFindFirst.mockResolvedValue({ id: 'synthetic-invoice', status: 'CANCELLED', events: neverSent });
  const response = await receipt(request(), params);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
  expect(mockReceipt).not.toHaveBeenCalled();
  expect(mockFindFirst).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ events: true }) }));
});

test('a parent cannot turn DRAFT receipt lookup into a financial status disclosure', async () => {
  mockFindFirst.mockResolvedValue({ id: 'synthetic-invoice', status: 'DRAFT' });
  const response = await receipt(request(), params);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
  expect(mockReceipt).not.toHaveBeenCalled();
});

test.each([null, undefined, 'UNKNOWN'])('external access fails closed for non-published status %s', async status => {
  mockFindFirst.mockResolvedValue({ id: 'synthetic-invoice', number: 'SYNTHETIC', pdfPath: 'synthetic.pdf', status });
  const response = await GET(request(true), params);
  expect(response.status).toBe(404);
  expect(mockReadPdf).not.toHaveBeenCalled();
});

test.each(['ADMIN', 'ASSISTANTE'])('authorized %s keeps private draft preview', async role => {
  mockAuth.mockResolvedValue({ user: { id: 'synthetic-staff', role } });
  mockFindFirst.mockResolvedValue({ id: 'synthetic-invoice', number: 'SYNTHETIC', pdfPath: 'synthetic.pdf', status: 'DRAFT' });
  const response = await GET(request(), params);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});

test('paid receipt is private and does not leak its referring URL', async () => {
  mockFindFirst.mockResolvedValue({ id: 'synthetic-invoice', number: 'SYNTHETIC', status: 'PAID',
    issuedAt: new Date('2026-10-01T00:00:00Z'), paidAt: new Date('2026-10-01T00:00:00Z'), paidAmount: 1000,
    currency: 'TND', events: [] });
  mockReceipt.mockResolvedValue(Buffer.from('%PDF-synthetic-receipt'));
  const response = await receipt(request(), params);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
});

test('receipt audit failures are observable without private exception contents', async () => {
  const privateCanary = 'SYNTHETIC-PRIVATE-AUDIT-CANARY';
  mockFindFirst.mockResolvedValue({ id: 'synthetic-invoice', number: 'SYNTHETIC', status: 'PAID',
    issuedAt: new Date('2026-10-01T00:00:00Z'), paidAt: new Date('2026-10-01T00:00:00Z'),
    paidAmount: 1000, currency: 'TND', events: [] });
  mockReceipt.mockResolvedValue(Buffer.from('%PDF-synthetic-receipt'));
  mockAppendAudit.mockRejectedValueOnce(new Error(privateCanary));
  const logging = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const response = await receipt(request(), params);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
    expect(logging).toHaveBeenCalledWith('INVOICE_RECEIPT_READ_FAILED');
    expect(JSON.stringify(logging.mock.calls)).not.toContain(privateCanary);
  } finally {
    logging.mockRestore();
  }
});
