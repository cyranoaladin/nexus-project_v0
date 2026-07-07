import { GET, POST } from '@/app/api/lamis/teacher-report/route';
import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn((result): result is Response => result instanceof Response),
}));

jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockIsErrorResponse = isErrorResponse as unknown as jest.Mock;
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
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    mockIsErrorResponse.mockImplementation((result: unknown): result is Response => result instanceof Response);
    mockGuardRateLimit.mockResolvedValue(null);
  });

  it('returns 401 for anonymous requests before rate limiting or parsing', async () => {
    const unauthorized = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    mockRequireAnyRole.mockResolvedValue(unauthorized);
    mockIsErrorResponse.mockReturnValue(true);

    const res = await POST(postRequest({ attempts: [validAttempt] }));

    expect(res.status).toBe(401);
    expect(mockGuardRateLimit).not.toHaveBeenCalled();
  });

  it('returns 403 for roles outside staff and coach', async () => {
    const forbidden = new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    mockRequireAnyRole.mockResolvedValue(forbidden);
    mockIsErrorResponse.mockReturnValue(true);

    const res = await GET(new NextRequest('http://localhost:3000/api/lamis/teacher-report', { method: 'GET' }));

    expect(res.status).toBe(403);
    expect(mockRequireAnyRole).toHaveBeenCalledWith(['ADMIN', 'ASSISTANTE', 'COACH']);
    expect(mockGuardRateLimit).not.toHaveBeenCalled();
  });

  it('returns a report for a valid attempts payload', async () => {
    const res = await POST(postRequest({ attempts: [validAttempt] }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.report).toContain('Lamis');
    expect(mockGuardRateLimit).toHaveBeenCalledWith(expect.any(Request), expect.objectContaining({
      keySuffix: 'lamis-teacher-report',
      userId: 'coach-1',
    }));
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

  it('returns a GET report for an authorized coach', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/lamis/teacher-report', { method: 'GET' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.report).toContain('Lamis');
  });
});
