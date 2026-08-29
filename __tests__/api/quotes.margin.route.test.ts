jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: (v: unknown) => v instanceof Response,
}));
jest.mock('@/lib/quotes/margin.server', () => ({
  ...jest.requireActual('@/lib/quotes/margin.server'),
  getCommercialCostPolicy: jest.fn(),
}));
jest.mock('@/lib/quotes/recommendation', () => ({
  buildRecommendation: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/quotes/margin/route';
import { requireAnyRole } from '@/lib/guards';
import { getCommercialCostPolicy } from '@/lib/quotes/margin.server';
import { buildRecommendation } from '@/lib/quotes/recommendation';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockGetCostPolicy = getCommercialCostPolicy as jest.Mock;
const mockBuildRecommendation = buildRecommendation as jest.Mock;
const actualBuildRecommendation = jest.requireActual('@/lib/quotes/recommendation').buildRecommendation;

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/quotes/margin', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validBody = {
  situation: { level: 'terminale', examSession: 2027, specialites: ['MATHEMATIQUES', 'NSI'] },
  budget: { monthlyBudgetTnd: 200, strategy: 'RESPECT_BUDGET' },
};

describe('POST /api/quotes/margin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildRecommendation.mockImplementation(actualBuildRecommendation);
    mockGetCostPolicy.mockResolvedValue({
      teacherCostPerHourTnd: 100,
      variableCostPerStudentMonthTnd: 10,
      marginGates: { greenPct: 40, warningPct: 30 },
    });
  });

  test('rejects a non-staff caller', async () => {
    mockRequireAnyRole.mockResolvedValue(new Response('forbidden', { status: 403 }));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
  });

  test('staff gets a margin breakdown per scenario tier, never in a public-shaped field', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.marginByTier.ESSENTIEL).toBeDefined();
    expect(json.marginByTier.RECOMMANDE.gate).toMatch(/MARGIN_OK|HUMAN_REVIEW_REQUIRED|BLOCKED/);
    if (json.marginByTier.RECOMMANDE.reason == null) {
      expect(typeof json.marginByTier.RECOMMANDE.marginPct).toBe('number');
    }
  });

  test('sets Cache-Control: private, no-store', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });
    const res = await POST(makeRequest(validBody));
    expect(res.headers.get('Cache-Control')).toMatch(/no-store/);
  });

  test('rejects unknown fields (.strict())', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });
    const res = await POST(makeRequest({ ...validBody, extra: true }));
    expect(res.status).toBe(400);
  });

  test('returns an explicit review gate rather than a false MARGIN_OK when a recomputed PACK lacks its underlying cost basis', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });
    mockBuildRecommendation.mockReturnValue({
      scenarios: [{
        tier: 'RECOMMANDE',
        lines: [{ subject: 'pack', label: 'Pack agrégé', modality: 'PACK', hoursPerMonth: null, unitPriceMonthly: 1290 }],
        months: 10,
        matchedOfferId: 'terminale-libre-focus-bac',
      }],
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    const unavailableTiers = Object.values(json.marginByTier).filter(
      (margin) => (margin as { reason?: string }).reason === 'EXPLICIT_COST_BASIS_REQUIRED',
    );
    expect(unavailableTiers.length).toBeGreaterThan(0);
    expect(unavailableTiers).toEqual(expect.arrayContaining([
      expect.objectContaining({ gate: 'HUMAN_REVIEW_REQUIRED' }),
    ]));
  });
});
