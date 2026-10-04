import { NextRequest } from 'next/server';
const mockAuth = jest.fn();
const mockReadPdf = jest.fn();
const mockVerify = jest.fn();
const mockReceipt = jest.fn();
const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));
jest.mock('@/lib/prisma', () => ({ prisma: {
  invoice: { findUnique: (...args: unknown[]) => mockFindUnique(...args), findFirst: (...args: unknown[]) => mockFindFirst(...args), update: jest.fn().mockResolvedValue({}) },
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
});

test.each([false, true])('DRAFT cannot be downloaded through token path=%s', async token => {
  const invoice = { id: 'synthetic-invoice', number: 'SYNTHETIC', pdfPath: 'synthetic.pdf', status: 'DRAFT' };
  mockFindUnique.mockResolvedValue(invoice); mockFindFirst.mockResolvedValue(invoice);
  const response = await GET(request(token), params);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
  expect(mockReadPdf).not.toHaveBeenCalled();
});

test.each(['SENT', 'PAID', 'CANCELLED'])('published %s can be read but cannot be cached or leak token referrers', async status => {
  mockFindUnique.mockResolvedValue({ id: 'synthetic-invoice', number: 'SYNTHETIC', pdfPath: 'synthetic.pdf', status });
  const response = await GET(request(true), params);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
});

test('a parent cannot turn DRAFT receipt lookup into a financial status disclosure', async () => {
  mockFindFirst.mockResolvedValue({ id: 'synthetic-invoice', status: 'DRAFT' });
  const response = await receipt(request(), params);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
  expect(mockReceipt).not.toHaveBeenCalled();
});

test.each([null, undefined, 'UNKNOWN'])('external access fails closed for non-published status %s', async status => {
  mockFindUnique.mockResolvedValue({ id: 'synthetic-invoice', number: 'SYNTHETIC', pdfPath: 'synthetic.pdf', status });
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
