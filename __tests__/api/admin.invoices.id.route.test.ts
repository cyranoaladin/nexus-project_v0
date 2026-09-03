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

jest.mock('@/lib/entitlement', () => {
  const actual = jest.requireActual('@/lib/entitlement');
  return {
    activateEntitlements: jest.fn().mockResolvedValue({ created: 0, extended: 0, creditsGranted: 0, activatedCodes: [], noBeneficiary: false, skippedItems: 0 }),
    suspendEntitlements: jest.fn().mockResolvedValue({ suspended: 0, suspendedCodes: [] }),
    isCanonicalAriaAccessUniquenessConflict: actual.isCanonicalAriaAccessUniquenessConflict,
  };
});

import { PATCH } from '@/app/api/admin/invoices/[id]/route';
import { auth } from '@/auth';
import { validateTransition, canPerformStatusAction } from '@/lib/invoice';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;
const mockCanPerform = canPerformStatusAction as jest.Mock;
const mockValidateTransition = validateTransition as jest.Mock;

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

  // Cubic P2 (confidence 8): this MARK_PAID terminal transition also calls
  // activateEntitlements() inside its own transaction — a concurrent
  // MARK_PAID for the same invoice (e.g. two admins racing) can hit the
  // exact same canonical ARIA_ACCESS unique-constraint race as
  // payments/validate/route.ts, and must get the same retryable 409, not a
  // generic 500 that leaves the admin with no actionable next step.
  it('CODEX_CUBIC_P2_RED: returns 409 (not 500) when MARK_PAID races the canonical ARIA_ACCESS invoice-uniqueness constraint', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockCanPerform.mockReturnValue(true);
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'SENT', total: 450000, events: [],
    });
    mockValidateTransition.mockReturnValue({ valid: true, noop: false, targetStatus: 'PAID' });
    const prismaError = new Error('Unique constraint failed on the fields: (`userId`,`sourceInvoiceId`)');
    (prismaError as any).code = 'P2002';
    (prismaError as any).meta = { target: ['userId', 'sourceInvoiceId'] };
    prisma.$transaction.mockRejectedValue(prismaError);

    const res = await PATCH(...makeRequest('inv-1', {
      action: 'MARK_PAID',
      meta: { payment: { method: 'BANK_TRANSFER', amountPaid: 450000 } },
    }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('Conflit');
  });

  it('CODEX_CUBIC_P2_RED: an UNRELATED P2002 during MARK_PAID still returns 500, not a false retryable 409', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockCanPerform.mockReturnValue(true);
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1', number: 'NXS-2026-0001', status: 'SENT', total: 450000, events: [],
    });
    mockValidateTransition.mockReturnValue({ valid: true, noop: false, targetStatus: 'PAID' });
    const prismaError = new Error("Unique constraint failed on the fields: (`number`)");
    (prismaError as any).code = 'P2002';
    (prismaError as any).meta = { target: ['number'] };
    prisma.$transaction.mockRejectedValue(prismaError);

    const res = await PATCH(...makeRequest('inv-1', {
      action: 'MARK_PAID',
      meta: { payment: { method: 'BANK_TRANSFER', amountPaid: 450000 } },
    }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).not.toContain('Conflit');
  });
});
