/**
 * Admin Invoices Send API — Complete Test Suite
 *
 * Tests: POST /api/admin/invoices/[id]/send
 *
 * Source: app/api/admin/invoices/[id]/send/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/invoice', () => ({
  canPerformStatusAction: jest.fn(),
  createAccessToken: jest.fn().mockResolvedValue({
    rawToken: 'tok_abc123',
    tokenId: 'tid-1',
    expiresAt: new Date('2026-03-01T00:00:00Z'),
  }),
  TOKEN_EXPIRY_HOURS: 72,
  createInvoiceEvent: jest.fn().mockReturnValue({ type: 'EVENT', at: new Date().toISOString() }),
  appendInvoiceEvent: jest.fn().mockReturnValue([]),
  millimesToDisplay: jest.fn().mockReturnValue('450,000 TND'),
}));

jest.mock('@/lib/invoice/send-email', () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/admin/invoices/[id]/send/route';
import { auth } from '@/auth';
import { canPerformStatusAction, createAccessToken } from '@/lib/invoice';
import { sendInvoiceEmail } from '@/lib/invoice/send-email';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;
const mockCanPerform = canPerformStatusAction as jest.Mock;
const mockSendEmail = sendInvoiceEmail as jest.Mock;

import { prisma } from '@/lib/prisma';

beforeEach(async () => {
  jest.clearAllMocks();
});

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3000/api/admin/invoices/${id}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return [req, { params: Promise.resolve({ id }) }];
}

describe('POST /api/admin/invoices/[id]/send', () => {
  it('should return 404 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST(...makeRequest('inv-1'));
    expect(res.status).toBe(404);
  });

  it('should return 404 for unauthorized role', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } });
    mockCanPerform.mockReturnValue(false);

    const res = await POST(...makeRequest('inv-1'));
    expect(res.status).toBe(404);
  });

  it('should return 404 when invoice not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } });
    mockCanPerform.mockReturnValue(true);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await POST(...makeRequest('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('should return 409 when invoice not in SENT status', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } });
    mockCanPerform.mockReturnValue(true);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'DRAFT',
      total: 450000, customerName: 'Karim', customerEmail: 'k@test.com', events: [],
    });

    const res = await POST(...makeRequest('inv-1'));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('SENT');
  });

  it('should return 422 when no verified payer email', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } });
    mockCanPerform.mockReturnValue(true);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'SENT',
      total: 450000, customerName: 'Karim', customerEmail: null, events: [],
    });

    const res = await POST(...makeRequest('inv-1'));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toContain('email');
  });

  it('should return 429 when throttle exceeded', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } });
    mockCanPerform.mockReturnValue(true);
    const recentEvents = Array.from({ length: 3 }, () => ({
      type: 'INVOICE_SENT_EMAIL',
      at: new Date().toISOString(),
    }));
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'SENT',
      total: 450000, customerName: 'Karim', customerEmail: 'k@test.com',
      events: recentEvents, payerUserId: 'synthetic-payer',
      payer: { id: 'synthetic-payer', email: 'payer@example.invalid', emailVerifiedAt: new Date('2026-10-01T00:00:00Z') },
    });

    const res = await POST(...makeRequest('inv-1'));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toContain('Limite');
  });

  it('should send email and return success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } });
    mockCanPerform.mockReturnValue(true);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'SENT',
      total: 450000, customerName: 'Karim', customerEmail: 'karim@test.com',
      events: [], payerUserId: 'synthetic-payer',
      payer: { id: 'synthetic-payer', email: 'payer@example.invalid', emailVerifiedAt: new Date('2026-10-01T00:00:00Z') },
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValue({});

    const res = await POST(...makeRequest('inv-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sentTo).toBe('payer@example.invalid');
    expect(mockSendEmail).toHaveBeenCalledWith(
      'payer@example.invalid',
      expect.objectContaining({ invoiceNumber: 'NXS-2026-0001' })
    );
  });

  it('should return 500 on service error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } });
    mockCanPerform.mockReturnValue(true);
    jest.mocked(prisma.invoice.findUnique).mockRejectedValue(new Error('DB error'));

    const res = await POST(...makeRequest('inv-1'));
    expect(res.status).toBe(500);
  });
});


describe('financial recipient authority', () => {
  it.each([null,
    { id: 'synthetic-payer', email: 'payer@example.invalid', emailVerifiedAt: null },
    { id: 'synthetic-payer', email: null, emailVerifiedAt: new Date('2026-10-01T00:00:00Z') },
  ])(
    'does not issue a bearer link or send to an unverified legacy recipient', async payer => {
      mockAuth.mockResolvedValue({ user: { id: 'synthetic-staff', role: 'ADMIN' } });
      mockCanPerform.mockReturnValue(true);
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ id: 'synthetic-invoice', status: 'SENT',
        number: 'SYNTHETIC-1', total: 1000, customerEmail: 'other-guardian@example.invalid',
        events: [], payerUserId: payer?.id ?? null, payer });
      const result = await POST(...makeRequest('synthetic-invoice'));
      expect(result.status).toBe(422);
      expect(createAccessToken).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    },
  );
});
