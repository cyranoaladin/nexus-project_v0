jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/quotes/persistence.server', () => ({
  acceptQuoteByPublicToken: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/quotes/[id]/accept/route';
import { acceptQuoteByPublicToken } from '@/lib/quotes/persistence.server';

const mockAccept = acceptQuoteByPublicToken as jest.Mock;

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/quotes/quote-1/accept', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/quotes/[id]/accept', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects a missing token with 400', async () => {
    const res = await POST(makeRequest({}), { params: Promise.resolve({ id: 'quote-1' }) });
    expect(res.status).toBe(400);
  });

  test('rejects a token that does not resolve to any quote', async () => {
    mockAccept.mockResolvedValue({ ok: false, reason: 'NOT_FOUND' });
    const res = await POST(makeRequest({ token: 'garbage' }), { params: Promise.resolve({ id: 'quote-1' }) });
    expect(res.status).toBe(404);
    expect(mockAccept).toHaveBeenCalledWith('garbage', 'quote-1');
  });

  test('rejects a token that resolves to a DIFFERENT quote id than the one in the URL', async () => {
    mockAccept.mockResolvedValue({ ok: false, reason: 'NOT_FOUND' });
    const res = await POST(makeRequest({ token: 'valid-but-mismatched' }), { params: Promise.resolve({ id: 'quote-1' }) });
    expect(res.status).toBe(404);
    expect(mockAccept).toHaveBeenCalledWith('valid-but-mismatched', 'quote-1');
  });

  test('accepts and transitions to ACCEPTE when the token matches the quote id', async () => {
    mockAccept.mockResolvedValue({ ok: true, quote: { status: 'ACCEPTE' }, alreadyAccepted: false });
    const res = await POST(makeRequest({ token: 'valid-token' }), { params: Promise.resolve({ id: 'quote-1' }) });
    expect(res.status).toBe(200);
    expect(mockAccept).toHaveBeenCalledWith('valid-token', 'quote-1');
  });

  test('an invalid transition (already accepted/refused) resolves to 409', async () => {
    mockAccept.mockResolvedValue({ ok: false, reason: 'NOT_ACCEPTABLE' });
    const res = await POST(makeRequest({ token: 'valid-token' }), { params: Promise.resolve({ id: 'quote-1' }) });
    expect(res.status).toBe(409);
  });
});
