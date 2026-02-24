/**
 * Payments ClicToPay Init API — Complete Test Suite
 *
 * Tests: POST /api/payments/clictopay/init
 *
 * Source: app/api/payments/clictopay/init/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { POST } from '@/app/api/payments/clictopay/init/route';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.MockedFunction<typeof auth>;

beforeEach(() => {
  jest.clearAllMocks();
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
    mockAuth.mockResolvedValue(null as any);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Authentification');
  });

  it('should return 501 (not configured) for authenticated user', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'PARENT' } } as any);

    const res = await POST(makeRequest({ amount: 450, description: 'Abonnement Hybride' }));
    const body = await res.json();

    expect(res.status).toBe(501);
    expect(body.code).toBe('CLICTOPAY_NOT_CONFIGURED');
  });
});
