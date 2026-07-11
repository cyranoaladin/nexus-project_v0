/**
 * Payments ClicToPay Init API — Complete Test Suite
 *
 * Tests: POST /api/payments/clictopay/init
 *
 * Source: app/api/payments/clictopay/init/route.ts
 */

import { POST } from '@/app/api/payments/clictopay/init/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { NextRequest } from 'next/server';

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn((result): result is Response => result instanceof Response),
}));

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockIsErrorResponse = isErrorResponse as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsErrorResponse.mockImplementation((result: unknown): result is Response => result instanceof Response);
});

function makeRequest(body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/payments/clictopay/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

describe('POST /api/payments/clictopay/init', () => {
  it('should return 401 when not authenticated', async () => {
    const unauthorized = new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 });
    mockRequireAnyRole.mockResolvedValue(unauthorized);
    mockIsErrorResponse.mockReturnValue(true);

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
  });

  it('should return 501 (not configured) for authenticated user', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'u1', role: 'PARENT' } });

    const res = await POST(makeRequest({ amount: 450, description: 'Abonnement Hybride' }));
    const body = await res.json();

    expect(res.status).toBe(501);
    expect(body.code).toBe('CLICTOPAY_NOT_CONFIGURED');
  });

  it('should return 403 for unauthorized roles', async () => {
    const forbidden = new Response(JSON.stringify({ error: 'Accès refusé' }), { status: 403 });
    mockRequireAnyRole.mockResolvedValue(forbidden);
    mockIsErrorResponse.mockReturnValue(true);

    const res = await POST(makeRequest());

    expect(res.status).toBe(403);
    expect(mockRequireAnyRole).toHaveBeenCalledWith(['PARENT', 'ADMIN', 'ASSISTANTE']);
  });
});
