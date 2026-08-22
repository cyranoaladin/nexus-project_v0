jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/quotes/persistence.server', () => ({
  getQuoteByPublicToken: jest.fn(),
  transitionQuoteStatus: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/quotes/[id]/accept/route';
import { getQuoteByPublicToken, transitionQuoteStatus } from '@/lib/quotes/persistence.server';

const mockLookup = getQuoteByPublicToken as jest.Mock;
const mockTransition = transitionQuoteStatus as jest.Mock;

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/quotes/quote-1/accept', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/quotes/[id]/accept', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects a missing token with 400', async () => {
    const res = await POST(makeRequest({}), { params: { id: 'quote-1' } });
    expect(res.status).toBe(400);
  });

  test('rejects a token that does not resolve to any quote', async () => {
    mockLookup.mockResolvedValue({ quote: null, reason: 'NOT_FOUND' });
    const res = await POST(makeRequest({ token: 'garbage' }), { params: { id: 'quote-1' } });
    expect(res.status).toBe(404);
    expect(mockTransition).not.toHaveBeenCalled();
  });

  test('rejects a token that resolves to a DIFFERENT quote id than the one in the URL', async () => {
    mockLookup.mockResolvedValue({ quote: { id: 'some-other-quote-id' } });
    const res = await POST(makeRequest({ token: 'valid-but-mismatched' }), { params: { id: 'quote-1' } });
    expect(res.status).toBe(404);
    expect(mockTransition).not.toHaveBeenCalled();
  });

  test('accepts and transitions to ACCEPTE when the token matches the quote id', async () => {
    mockLookup.mockResolvedValue({ quote: { id: 'quote-1' } });
    mockTransition.mockResolvedValue({ status: 'ACCEPTE' });
    const res = await POST(makeRequest({ token: 'valid-token' }), { params: { id: 'quote-1' } });
    expect(res.status).toBe(200);
    expect(mockTransition).toHaveBeenCalledWith({ quoteId: 'quote-1', toStatus: 'ACCEPTE' });
  });

  test('an invalid transition (already accepted/refused) resolves to 409', async () => {
    mockLookup.mockResolvedValue({ quote: { id: 'quote-1' } });
    mockTransition.mockRejectedValue(new Error('Invalid quote status transition: REFUSE -> ACCEPTE'));
    const res = await POST(makeRequest({ token: 'valid-token' }), { params: { id: 'quote-1' } });
    expect(res.status).toBe(409);
  });
});
