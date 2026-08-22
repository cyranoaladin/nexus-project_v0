jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/guards', () => ({
  requireAuth: jest.fn(),
  isErrorResponse: (v: unknown) => v instanceof Response,
}));
jest.mock('@/lib/quotes/diagnostic.server', () => ({
  loadRawDomainScores: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/quotes/recommend/route';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { requireAuth } from '@/lib/guards';

const mockGuard = guardSensitiveRateLimit as jest.Mock;
const mockRequireAuth = requireAuth as jest.Mock;

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/quotes/recommend', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validSituation = {
  level: 'terminale',
  examSession: 2027,
  specialites: ['MATHEMATIQUES', 'NSI'],
};

describe('POST /api/quotes/recommend', () => {
  beforeEach(() => {
    mockGuard.mockResolvedValue(null);
    mockRequireAuth.mockResolvedValue(new Response('unauthorized', { status: 401 }));
  });

  test('rejects an invalid payload with 400', async () => {
    const res = await POST(makeRequest({ situation: { level: 'invalid' } }));
    expect(res.status).toBe(400);
  });

  test('rejects unknown fields (.strict())', async () => {
    const res = await POST(
      makeRequest({
        situation: validSituation,
        budget: { monthlyBudgetTnd: 1000, strategy: 'BEST_BALANCE' },
        somethingUnexpected: true,
      }),
    );
    expect(res.status).toBe(400);
  });

  test('returns 3 scenarios for an anonymous request with no diagnostic', async () => {
    const res = await POST(
      makeRequest({
        situation: validSituation,
        budget: { monthlyBudgetTnd: 1000, strategy: 'BEST_BALANCE' },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result.scenarios).toHaveLength(3);
    expect(json.result.pricingVersion).toBeTruthy();
  });

  test('never requires authentication to get an estimation (no PII collected)', async () => {
    const res = await POST(
      makeRequest({
        situation: validSituation,
        budget: { monthlyBudgetTnd: 500, strategy: 'RESPECT_BUDGET' },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockRequireAuth).not.toHaveBeenCalled(); // no diagnosticId => never touches auth
  });

  test('returns the rate-limit response unchanged when blocked', async () => {
    mockGuard.mockResolvedValueOnce(new Response('slow down', { status: 429 }));
    const res = await POST(
      makeRequest({ situation: validSituation, budget: { monthlyBudgetTnd: 500, strategy: 'RESPECT_BUDGET' } }),
    );
    expect(res.status).toBe(429);
  });

  test('an unsupported exam session resolves to a 400, not a 500 crash', async () => {
    const res = await POST(
      makeRequest({
        situation: { ...validSituation, examSession: 2099 },
        budget: { monthlyBudgetTnd: 500, strategy: 'RESPECT_BUDGET' },
      }),
    );
    expect(res.status).toBe(400);
  });
});
