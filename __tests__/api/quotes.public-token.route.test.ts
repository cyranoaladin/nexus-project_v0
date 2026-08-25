jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/quotes/persistence.server', () => ({
  getQuoteByPublicToken: jest.fn(),
  markQuoteConsultedIfSent: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/quotes/public/[token]/route';
import { getQuoteByPublicToken, markQuoteConsultedIfSent } from '@/lib/quotes/persistence.server';

const mockLookup = getQuoteByPublicToken as jest.Mock;
const mockMarkConsulted = markQuoteConsultedIfSent as jest.Mock;

function makeRequest(token: string) {
  return new NextRequest(`http://localhost:3000/api/quotes/public/${token}`);
}

describe('GET /api/quotes/public/[token]', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 404 for a token that does not resolve', async () => {
    mockLookup.mockResolvedValue({ quote: null, reason: 'NOT_FOUND' });
    const res = await GET(makeRequest('does-not-exist'), { params: Promise.resolve({ token: 'does-not-exist' }) });
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
    mockMarkConsulted.mockResolvedValue(new Date('2027-01-02T03:04:05.000Z'));

    const res = await GET(makeRequest('valid-token'), { params: Promise.resolve({ token: 'valid-token' }) });
    expect(res.status).toBe(200);
    const json = await res.json();

    const serialized = JSON.stringify(json).toLowerCase();
    for (const forbidden of ['idempotencykey', 'createdbyuserid', 'teachercost', 'margin']) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(json.quote.monthlyTotal).toBe(790);
    expect(json.quote.status).toBe('DEVIS_CONSULTE');
    expect(json.quote).not.toHaveProperty('revisionNumber');
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
        lines: [],
      },
    });
    mockMarkConsulted.mockResolvedValue(new Date('2027-01-02T03:04:05.000Z'));

    await GET(makeRequest('valid-token'), { params: Promise.resolve({ token: 'valid-token' }) });
    expect(mockMarkConsulted).toHaveBeenCalledWith('quote-1');
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
        lines: [],
      },
    });
    mockMarkConsulted.mockRejectedValue(new Error('boom'));

    const res = await GET(makeRequest('valid-token'), { params: Promise.resolve({ token: 'valid-token' }) });
    expect(res.status).toBe(200);
  });

  test('sets Cache-Control: private, no-store', async () => {
    mockLookup.mockResolvedValue({ quote: null, reason: 'NOT_FOUND' });
    const res = await GET(makeRequest('x'), { params: Promise.resolve({ token: 'x' }) });
    expect(res.headers.get('Cache-Control')).toMatch(/no-store/);
  });
});
