jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/quotes/public-view.server', () => ({
  getQuoteForFamilyView: jest.fn(),
}));
jest.mock('@/lib/quotes/persistence.server', () => ({
  transitionQuoteStatus: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/quotes/public/[token]/accept/route';
import { getQuoteForFamilyView } from '@/lib/quotes/public-view.server';
import { transitionQuoteStatus } from '@/lib/quotes/persistence.server';

const mockFamilyLookup = getQuoteForFamilyView as jest.Mock;
const mockTransition = transitionQuoteStatus as jest.Mock;

function request() {
  return new NextRequest('http://localhost:3000/api/quotes/public/link/accept', { method: 'POST' });
}

describe('POST /api/quotes/public/[token]/accept', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects an unresolved token without attempting a transition', async () => {
    mockFamilyLookup.mockResolvedValue({ quote: null, reason: 'NOT_FOUND' });
    const response = await POST(request(), { params: Promise.resolve({ token: 'invalid-link' }) });
    expect(response.status).toBe(404);
    expect(mockTransition).not.toHaveBeenCalled();
  });

  test('resolves the quote server-side from the token and returns only a human result', async () => {
    mockFamilyLookup.mockResolvedValue({ quote: { id: 'server-only-quote-id', status: 'DEVIS_CONSULTE' } });
    mockTransition.mockResolvedValue({ status: 'ACCEPTE' });
    const token = ['family', 'accept', 'sentinel'].join('-');

    const response = await POST(request(), { params: Promise.resolve({ token }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockFamilyLookup).toHaveBeenCalledWith(token);
    expect(mockTransition).toHaveBeenCalledWith({ quoteId: 'server-only-quote-id', toStatus: 'ACCEPTE' });
    expect(json).toEqual({ ok: true, message: 'Devis accepté' });
    expect(JSON.stringify(json)).not.toMatch(/server-only-quote-id|ACCEPTE|DEVIS_|token/i);
  });
});
