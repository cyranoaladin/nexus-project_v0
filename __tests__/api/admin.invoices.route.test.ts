/**
 * Admin Invoices API — Complete Test Suite
 *
 * Tests: GET /api/admin/invoices (list, paginated)
 *        POST /api/admin/invoices (create — auth/validation only)
 *
 * Source: app/api/admin/invoices/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/invoice', () => ({
  generateInvoiceNumber: jest.fn().mockResolvedValue('NXS-2026-0001'),
  renderInvoicePDF: jest.fn().mockResolvedValue(Buffer.from('fake-pdf')),
  storeInvoicePDF: jest.fn().mockResolvedValue('/storage/invoices/NXS-2026-0001.pdf'),
  getInvoiceUrl: jest.fn().mockReturnValue('/api/invoices/inv-1/pdf'),
  InvoiceOverflowError: class extends Error { constructor(m: string) { super(m); this.name = 'InvoiceOverflowError'; } },
  MillimesValidationError: class extends Error { constructor(m: string) { super(m); this.name = 'MillimesValidationError'; } },
  createInvoiceEvent: jest.fn().mockReturnValue({ type: 'INVOICE_CREATED', at: new Date().toISOString() }),
  appendInvoiceEvent: jest.fn().mockReturnValue([]),
  assertMillimes: jest.fn(),
}));

import { GET, POST } from '@/app/api/admin/invoices/route';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.MockedFunction<typeof auth>;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

// ─── GET /api/admin/invoices ─────────────────────────────────────────────────

describe('GET /api/admin/invoices', () => {
  function makeGetRequest(params?: string): NextRequest {
    const url = params
      ? `http://localhost:3000/api/admin/invoices?${params}`
      : 'http://localhost:3000/api/admin/invoices';
    return new NextRequest(url, { method: 'GET' });
  }

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-staff role', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it('should return paginated invoices for ADMIN', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', number: 'NXS-2026-0001', customerName: 'Karim', total: 450000 },
    ]);
    prisma.invoice.count.mockResolvedValue(1);

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invoices).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
    expect(body.pagination.page).toBe(1);
  });

  it('should support pagination params', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.count.mockResolvedValue(50);

    const res = await GET(makeGetRequest('page=2&limit=10'));
    const body = await res.json();

    expect(body.pagination.page).toBe(2);
    expect(body.pagination.limit).toBe(10);
    expect(body.pagination.totalPages).toBe(5);
  });

  it('should support status filter', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.count.mockResolvedValue(0);

    await GET(makeGetRequest('status=PAID'));

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PAID' }),
      })
    );
  });

  it('should support search filter', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.count.mockResolvedValue(0);

    await GET(makeGetRequest('search=Karim'));

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ customerName: expect.any(Object) }),
          ]),
        }),
      })
    );
  });

  it('should return 500 on DB error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    prisma.invoice.findMany.mockRejectedValue(new Error('DB error'));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/admin/invoices ────────────────────────────────────────────────

describe('POST /api/admin/invoices', () => {
  function makePostRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3000/api/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await POST(makePostRequest({ customer: { name: 'Test' }, items: [] }));
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-staff role', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'PARENT' } } as any);

    const res = await POST(makePostRequest({ customer: { name: 'Test' }, items: [] }));
    expect(res.status).toBe(403);
  });

  it('should return 400 for missing customer name', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);

    const res = await POST(makePostRequest({ customer: {}, items: [{ label: 'Test', qty: 1, unitPrice: 1000 }] }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('customer.name');
  });

  it('should return 400 for empty items', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);

    const res = await POST(makePostRequest({ customer: { name: 'Karim' }, items: [] }));
    expect(res.status).toBe(400);
  });

  it('should create invoice successfully', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    prisma.invoice.create.mockResolvedValue({
      id: 'inv-1',
      number: 'NXS-2026-0001',
      issuedAt: new Date(),
      dueAt: null,
      issuerName: 'M&M Academy',
      issuerAddress: 'Tunis',
      issuerMF: '1XXX',
      issuerRNE: null,
      customerName: 'Karim',
      customerEmail: null,
      customerAddress: null,
      customerId: null,
      currency: 'TND',
      subtotal: 450000,
      discountTotal: 0,
      taxTotal: 0,
      total: 450000,
      taxRegime: 'TVA_NON_APPLICABLE',
      events: [],
      items: [{ label: 'Abonnement Hybride', qty: 1, unitPrice: 450000, total: 450000, description: null, sortOrder: 0 }],
    });
    prisma.invoice.update.mockResolvedValue({});

    const res = await POST(makePostRequest({
      customer: { name: 'Karim' },
      items: [{ label: 'Abonnement Hybride', qty: 1, unitPrice: 450000 }],
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.number).toBe('NXS-2026-0001');
    expect(body.pdfUrl).toBeTruthy();
  });
});
