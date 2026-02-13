jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number; headers?: HeadersInit }) => ({
      status: init?.status,
      body,
      headers: init?.headers,
    }),
  },
}));

import { rateLimit, clearRateLimit, getRateLimitStatus } from '@/lib/middleware/rateLimit';

describe('middleware rateLimit', () => {
  const request = {
    headers: new Headers({ 'x-forwarded-for': '1.2.3.4' }),
  } as any;

  beforeEach(() => {
    clearRateLimit(request);
  });

  it('allows requests under the limit', () => {
    const limiter = rateLimit({ windowMs: 1000, maxRequests: 2 });
    const res1 = limiter(request);
    const res2 = limiter(request);
    expect(res1).toBeNull();
    expect(res2).toBeNull();
  });

  it('blocks when limit exceeded', () => {
    const limiter = rateLimit({ windowMs: 1000, maxRequests: 1 });
    const res1 = limiter(request);
    const res2 = limiter(request) as any;
    expect(res1).toBeNull();
    expect(res2.status).toBe(429);
    expect(res2.body.error).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('getRateLimitStatus reports remaining', () => {
    const limiter = rateLimit({ windowMs: 1000, maxRequests: 2 });
    limiter(request);
    const status = getRateLimitStatus(request, { windowMs: 1000, maxRequests: 2 });
    expect(status.remaining).toBe(1);
  });
});
