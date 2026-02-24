/**
 * Invoices Receipt PDF API — Complete Test Suite
 *
 * Tests: GET /api/invoices/[id]/receipt/pdf
 *
 * Source: app/api/invoices/[id]/receipt/pdf/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/invoice', () => ({
  renderReceiptPDF: jest.fn().mockResolvedValue(Buffer.from('fake-receipt-pdf')),
  createInvoiceEvent: jest.fn().mockReturnValue({ type: 'RECEIPT_RENDERED', at: new Date().toISOString() }),
  appendInvoiceEvent: jest.fn().mockReturnValue([]),
}));

jest.mock('@/lib/invoice/not-found', () => ({
  notFoundResponse: jest.fn().mockReturnValue(
    new (require('next/server').NextResponse)(JSON.stringify({ error: 'Facture introuvable' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  buildInvoiceScopeWhere: jest.fn(),
}));

import { GET } from '@/app/api/invoices/[id]/receipt/pdf/route';
import { auth } from '@/auth';
import { buildInvoiceScopeWhere } from '@/lib/invoice/not-found';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockBuildScope = buildInvoiceScopeWhere as jest.MockedFunction<typeof buildInvoiceScopeWhere>;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3000/api/invoices/${id}/receipt/pdf`, { method: 'GET' });
  return [req, { params: Promise.resolve({ id }) }];
}

describe('GET /api/invoices/[id]/receipt/pdf', () => {
  it('should return 404 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await GET(...makeRequest('inv-1'));
    expect(res.status).toBe(404);
  });

  it('should return 404 for unauthorized role', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE', email: 'e@t.com' } } as any);
    mockBuildScope.mockReturnValue(null as any);

    const res = await GET(...makeRequest('inv-1'));
    expect(res.status).toBe(404);
  });

  it('should return 404 when invoice not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN', email: 'a@t.com' } } as any);
    mockBuildScope.mockReturnValue({ id: 'inv-1' } as any);
    prisma.invoice.findFirst.mockResolvedValue(null);

    const res = await GET(...makeRequest('inv-1'));
    expect(res.status).toBe(404);
  });

  it('should return 409 when invoice not PAID', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN', email: 'a@t.com' } } as any);
    mockBuildScope.mockReturnValue({ id: 'inv-1' } as any);
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'SENT',
      paidAt: null, paidAmount: null, events: [],
    });

    const res = await GET(...makeRequest('inv-1'));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('payées');
  });

  it('should stream receipt PDF for PAID invoice', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN', email: 'a@t.com' } } as any);
    mockBuildScope.mockReturnValue({ id: 'inv-1' } as any);
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'PAID',
      issuedAt: new Date('2026-02-01'), paidAt: new Date('2026-02-15'),
      paidAmount: 450000, currency: 'TND', paymentMethod: 'bank_transfer',
      paymentReference: 'REF-123',
      customerName: 'Karim', customerEmail: 'k@t.com', customerAddress: 'Tunis',
      issuerName: 'M&M Academy', issuerAddress: 'Ariana', issuerMF: '1XXX',
      total: 450000, events: [],
    });
    prisma.invoice.update.mockResolvedValue({});

    const res = await GET(...makeRequest('inv-1'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('NXS-2026-0001');
  });

  it('should return 404 on DB error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN', email: 'a@t.com' } } as any);
    mockBuildScope.mockReturnValue({ id: 'inv-1' } as any);
    prisma.invoice.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await GET(...makeRequest('inv-1'));
    expect(res.status).toBe(404);
  });
});
