/**
 * Invoices PDF API — Complete Test Suite
 *
 * Tests: GET /api/invoices/[id]/pdf
 *
 * Source: app/api/invoices/[id]/pdf/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/invoice', () => ({
  readInvoicePDF: jest.fn().mockResolvedValue(Buffer.from('fake-pdf')),
  verifyAccessToken: jest.fn(),
}));

jest.mock('@/lib/invoice/not-found', () => {
  const { NextResponse } = jest.requireActual<typeof import('next/server')>('next/server');
  return {
    notFoundResponse: jest.fn(() => new NextResponse(JSON.stringify({ error: 'Facture introuvable' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    })),
    buildInvoiceAccessWhere: jest.fn(),
  };
});

import { GET } from '@/app/api/invoices/[id]/pdf/route';
import { auth } from '@/auth';
import { verifyAccessToken } from '@/lib/invoice';
import { buildInvoiceAccessWhere } from '@/lib/invoice/not-found';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

const mockAuth = auth as jest.Mock;
const mockVerifyToken = verifyAccessToken as jest.Mock;
const mockBuildScope = buildInvoiceAccessWhere as jest.Mock;

beforeEach(() => { jest.clearAllMocks(); });

function makeRequest(id: string, token?: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const url = token
    ? `http://localhost:3000/api/invoices/${id}/pdf?token=${token}`
    : `http://localhost:3000/api/invoices/${id}/pdf`;
  const req = new NextRequest(url, { method: 'GET' });
  return [req, { params: Promise.resolve({ id }) }];
}

describe('GET /api/invoices/[id]/pdf — Token-based access', () => {
  it('should return 404 for invalid token', async () => {
    mockVerifyToken.mockResolvedValue({ valid: false });

    const res = await GET(...makeRequest('inv-1', 'bad-token'));
    expect(res.status).toBe(404);
  });

  it('should return 404 when token invoiceId mismatch', async () => {
    mockVerifyToken.mockResolvedValue({ valid: true, invoiceId: 'inv-other' });

    const res = await GET(...makeRequest('inv-1', 'tok-abc'));
    expect(res.status).toBe(404);
  });

  it('should stream PDF for valid token and an authorized financial session', async () => {
    mockAuth.mockResolvedValue({user:{id:'synthetic-payer',role:'PARENT'}});
    mockBuildScope.mockResolvedValue({id:'inv-1',payerUserId:'synthetic-payer',status:{not:'DRAFT'}});
    mockVerifyToken.mockResolvedValue({ valid: true, invoiceId: 'inv-1' });
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'SENT', pdfPath: '/storage/invoices/NXS-2026-0001.pdf',
    });

    const res = await GET(...makeRequest('inv-1', 'tok-valid'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });

  it('should return 404 when an authorized link has no pdfPath', async () => {
    mockAuth.mockResolvedValue({user:{id:'synthetic-payer',role:'PARENT'}});
    mockBuildScope.mockResolvedValue({id:'inv-1',payerUserId:'synthetic-payer',status:{not:'DRAFT'}});
    mockVerifyToken.mockResolvedValue({ valid: true, invoiceId: 'inv-1' });
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'SENT', pdfPath: null,
    });

    const res = await GET(...makeRequest('inv-1', 'tok-valid'));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/invoices/[id]/pdf — Session-based access', () => {
  it('should return 404 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(...makeRequest('inv-1'));
    expect(res.status).toBe(404);
  });

  it('should return 404 for unauthorized role', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE', email: 'e@t.com' } });
    mockBuildScope.mockResolvedValue(null);

    const res = await GET(...makeRequest('inv-1'));
    expect(res.status).toBe(404);
  });

  it('should stream PDF for ADMIN', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN', email: 'a@t.com' } });
    mockBuildScope.mockResolvedValue({ id: 'inv-1' });
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'SENT', pdfPath: '/storage/invoices/NXS-2026-0001.pdf',
    });

    const res = await GET(...makeRequest('inv-1'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('NXS-2026-0001');
  });

  it('should return 404 when invoice not found in scope', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'p1', role: 'PARENT', email: 'p@t.com' } });
    mockBuildScope.mockResolvedValue({ id: 'inv-1', OR: [{ customerEmail: 'p@t.com' }] });
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await GET(...makeRequest('inv-1'));
    expect(res.status).toBe(404);
  });
});
