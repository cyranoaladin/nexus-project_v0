import { GET, POST } from '@/app/api/lamis/teacher-report/route';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

const mockGuardRateLimit = guardRateLimitAsync as jest.Mock;

const validAttempt = {
  exerciseId: 'pct-coef-baisse-25',
  answer: '0.75',
  isCorrect: true,
  attemptNumber: 1,
  timeSpentSeconds: 45,
  usedHint1: false,
  usedHint2: false,
  viewedCorrection: false,
  tooFast: false,
  timestamp: '2026-07-02T12:00:00.000Z',
};

function postRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/lamis/teacher-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Lamis teacher-report API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGuardRateLimit.mockResolvedValue(null);
  });

  it('returns a report for a valid attempts payload', async () => {
    const res = await POST(postRequest({ attempts: [validAttempt] }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.report).toContain('Lamis');
  });

  it('rejects unexpected payload fields', async () => {
    const res = await POST(postRequest({ attempts: [validAttempt], studentEmail: 'child@example.test' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Payload invalide');
  });

  it('rejects malformed attempts', async () => {
    const res = await POST(postRequest({ attempts: [{ ...validAttempt, answer: 42 }] }));

    expect(res.status).toBe(400);
  });

  it('returns 429 before parsing when rate limit is exceeded', async () => {
    mockGuardRateLimit.mockResolvedValue(new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }));

    const res = await POST(postRequest({ attempts: [validAttempt] }));

    expect(res.status).toBe(429);
  });

  it('rate limits GET report generation', async () => {
    mockGuardRateLimit.mockResolvedValue(new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }));

    const res = await GET(new NextRequest('http://localhost:3000/api/lamis/teacher-report', { method: 'GET' }));

    expect(res.status).toBe(429);
  });
});
