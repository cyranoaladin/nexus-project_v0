jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/quotes/persistence.server', () => ({
  getQuoteByPublicToken: jest.fn(),
  transitionQuoteStatus: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/quotes/public/[token]/route';
import { getQuoteByPublicToken, transitionQuoteStatus } from '@/lib/quotes/persistence.server';

const mockLookup = getQuoteByPublicToken as jest.Mock;
const mockTransition = transitionQuoteStatus as jest.Mock;

function makeRequest(token: string) {
  return new NextRequest(`http://localhost:3000/api/quotes/public/${token}`);
}

describe('GET /api/quotes/public/[token]', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 404 for a token that does not resolve', async () => {
    mockLookup.mockResolvedValue({ quote: null, reason: 'NOT_FOUND' });
    const res = await GET(makeRequest('does-not-exist'), { params: { token: 'does-not-exist' } });
    expect(res.status).toBe(404);
  });

  test('never leaks cost/margin/internal ids in the family-facing projection', async () => {
    mockLookup.mockResolvedValue({
      quote: {
        id: 'quote-1',
        status: 'DEVIS_ENVOYE',
        examSession: 2027,
        budget: 1000,
        strategy: 'BEST_BALANCE',
        matchedOfferId: null,
        currency: 'TND',
        monthlyTotal: 790,
        grandTotal: 7900,
        validUntil: new Date().toISOString(),
        revisionNumber: 1,
        idempotencyKey: 'should-not-appear',
        createdByUserId: 'staff-should-not-appear',
        lines: [
          {
            subject: 'Français',
            modality: 'GROUPE',
            hoursPerMonth: 8,
            unitPrice: 470,
            months: 10,
            lineTotal: 4700,
            reason: 'ok',
            sortOrder: 0,
          },
        ],
      },
    });
    mockTransition.mockResolvedValue({});

    const res = await GET(makeRequest('valid-token'), { params: { token: 'valid-token' } });
    expect(res.status).toBe(200);
    const json = await res.json();

    const serialized = JSON.stringify(json).toLowerCase();
    for (const forbidden of ['idempotencykey', 'createdbyuserid', 'teachercost', 'margin']) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(json.quote.monthlyTotal).toBe(790);
  });

  test('auto-advances DEVIS_ENVOYE to DEVIS_CONSULTE on first view', async () => {
    mockLookup.mockResolvedValue({
      quote: {
        id: 'quote-1',
        status: 'DEVIS_ENVOYE',
        examSession: 2027,
        budget: 1000,
        strategy: 'BEST_BALANCE',
        matchedOfferId: null,
        currency: 'TND',
        monthlyTotal: 790,
        grandTotal: 7900,
        validUntil: new Date().toISOString(),
        revisionNumber: 1,
        lines: [],
      },
    });
    mockTransition.mockResolvedValue({});

    await GET(makeRequest('valid-token'), { params: { token: 'valid-token' } });
    expect(mockTransition).toHaveBeenCalledWith(
      expect.objectContaining({ quoteId: 'quote-1', toStatus: 'DEVIS_CONSULTE' }),
    );
  });

  test('a failed auto-transition never breaks the read', async () => {
    mockLookup.mockResolvedValue({
      quote: {
        id: 'quote-1',
        status: 'DEVIS_ENVOYE',
        examSession: 2027,
        budget: 1000,
        strategy: 'BEST_BALANCE',
        matchedOfferId: null,
        currency: 'TND',
        monthlyTotal: 790,
        grandTotal: 7900,
        validUntil: new Date().toISOString(),
        revisionNumber: 1,
        lines: [],
      },
    });
    mockTransition.mockRejectedValue(new Error('boom'));

    const res = await GET(makeRequest('valid-token'), { params: { token: 'valid-token' } });
    expect(res.status).toBe(200);
  });

  test('sets Cache-Control: private, no-store', async () => {
    mockLookup.mockResolvedValue({ quote: null, reason: 'NOT_FOUND' });
    const res = await GET(makeRequest('x'), { params: { token: 'x' } });
    expect(res.headers.get('Cache-Control')).toMatch(/no-store/);
  });
});
