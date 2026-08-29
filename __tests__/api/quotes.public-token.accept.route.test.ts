jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/quotes/persistence.server', () => ({
  acceptQuoteByPublicToken: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/quotes/public/[token]/accept/route';
import { acceptQuoteByPublicToken } from '@/lib/quotes/persistence.server';

const mockAccept = acceptQuoteByPublicToken as jest.Mock;

function request() {
  return new NextRequest('http://localhost:3000/api/quotes/public/link/accept', { method: 'POST' });
}

describe('POST /api/quotes/public/[token]/accept', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects an unresolved token through the atomic boundary', async () => {
    mockAccept.mockResolvedValue({ ok: false, reason: 'NOT_FOUND' });
    const response = await POST(request(), { params: Promise.resolve({ token: 'invalid-link' }) });
    expect(response.status).toBe(404);
    expect(mockAccept).toHaveBeenCalledWith('invalid-link');
  });

  test('accepts only through the token-lock boundary and returns a human result', async () => {
    mockAccept.mockResolvedValue({ ok: true, quote: { status: 'ACCEPTE' }, alreadyAccepted: false });
    const token = ['family', 'accept', 'sentinel'].join('-');

    const response = await POST(request(), { params: Promise.resolve({ token }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockAccept).toHaveBeenCalledWith(token);
    expect(json).toEqual({ ok: true, message: 'Devis accepté' });
    expect(JSON.stringify(json)).not.toMatch(/server-only-quote-id|ACCEPTE|DEVIS_|token/i);
  });

  test('maps a valid but non-acceptable quote to 409', async () => {
    mockAccept.mockResolvedValue({ ok: false, reason: 'NOT_ACCEPTABLE' });
    const response = await POST(request(), { params: Promise.resolve({ token: 'valid-link' }) });
    expect(response.status).toBe(409);
  });
});
