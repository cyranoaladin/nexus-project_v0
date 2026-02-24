/**
 * Admin Invoices [id] API — Complete Test Suite
 *
 * Tests: PATCH /api/admin/invoices/[id]
 *
 * Source: app/api/admin/invoices/[id]/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/invoice', () => ({
  validateTransition: jest.fn(),
  canPerformStatusAction: jest.fn(),
  createInvoiceEvent: jest.fn().mockReturnValue({ type: 'STATUS_CHANGED', at: new Date().toISOString() }),
  appendInvoiceEvent: jest.fn().mockReturnValue([]),
}));

jest.mock('@/lib/entitlement', () => ({
  activateEntitlements: jest.fn().mockResolvedValue({ created: 0, extended: 0, creditsGranted: 0, activatedCodes: [], noBeneficiary: false, skippedItems: 0 }),
  suspendEntitlements: jest.fn().mockResolvedValue({ suspended: 0, suspendedCodes: [] }),
}));

import { PATCH } from '@/app/api/admin/invoices/[id]/route';
import { auth } from '@/auth';
import { validateTransition, canPerformStatusAction } from '@/lib/invoice';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockCanPerform = canPerformStatusAction as jest.MockedFunction<typeof canPerformStatusAction>;
const mockValidateTransition = validateTransition as jest.MockedFunction<typeof validateTransition>;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

function makeRequest(id: string, body: Record<string, unknown>): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3000/api/admin/invoices/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return [req, { params: Promise.resolve({ id }) }];
}

describe('PATCH /api/admin/invoices/[id]', () => {
  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await PATCH(...makeRequest('inv-1', { action: 'MARK_SENT' }));
    expect(res.status).toBe(401);
  });

  it('should return 404 for unauthorized role', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    mockCanPerform.mockReturnValue(false);

    const res = await PATCH(...makeRequest('inv-1', { action: 'MARK_SENT' }));
    expect(res.status).toBe(404);
  });

  it('should return 400 for invalid action', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockCanPerform.mockReturnValue(true);

    const res = await PATCH(...makeRequest('inv-1', { action: 'INVALID' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Action invalide');
  });

  it('should return 404 when invoice not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockCanPerform.mockReturnValue(true);
    prisma.invoice.findFirst.mockResolvedValue(null);

    const res = await PATCH(...makeRequest('nonexistent', { action: 'MARK_SENT' }));
    expect(res.status).toBe(404);
  });

  it('should return 409 for invalid transition', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockCanPerform.mockReturnValue(true);
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'PAID', total: 450000, events: [],
    });
    mockValidateTransition.mockReturnValue({ valid: false, error: 'Transition invalide', httpStatus: 409 });

    const res = await PATCH(...makeRequest('inv-1', { action: 'MARK_SENT' }));
    expect(res.status).toBe(409);
  });

  it('should handle noop (idempotent)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockCanPerform.mockReturnValue(true);
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'SENT', total: 450000, events: [],
    });
    mockValidateTransition.mockReturnValue({ valid: true, noop: true });

    const res = await PATCH(...makeRequest('inv-1', { action: 'MARK_SENT' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.noop).toBe(true);
  });

  it('should mark invoice as SENT (non-terminal)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockCanPerform.mockReturnValue(true);
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'DRAFT', total: 450000, events: [],
    });
    mockValidateTransition.mockReturnValue({ valid: true, noop: false, targetStatus: 'SENT' });
    prisma.invoice.update.mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'SENT', updatedAt: new Date(),
    });

    const res = await PATCH(...makeRequest('inv-1', { action: 'MARK_SENT' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('SENT');
  });

  it('should return 500 on DB error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockCanPerform.mockReturnValue(true);
    prisma.invoice.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await PATCH(...makeRequest('inv-1', { action: 'MARK_SENT' }));
    expect(res.status).toBe(500);
  });
});
