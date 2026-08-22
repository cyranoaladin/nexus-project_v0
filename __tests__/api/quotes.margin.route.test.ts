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

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/quotes/margin/route';
import { requireAnyRole } from '@/lib/guards';
import { getCommercialCostPolicy } from '@/lib/quotes/margin.server';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockGetCostPolicy = getCommercialCostPolicy as jest.Mock;

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/quotes/margin', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validBody = {
  situation: { level: 'terminale', examSession: 2027, specialites: ['MATHEMATIQUES', 'NSI'] },
  budget: { monthlyBudgetTnd: 1000, strategy: 'BEST_BALANCE' },
};

describe('POST /api/quotes/margin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(json.marginByTier.RECOMMANDE.gate).toMatch(/GREEN|WARNING|BLOCKED/);
    expect(typeof json.marginByTier.RECOMMANDE.marginPct).toBe('number');
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
});
