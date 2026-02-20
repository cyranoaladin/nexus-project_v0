const limitMock = jest.fn();

jest.mock('@upstash/redis', () => ({
  Redis: class Redis {
    constructor() {}
  },
}));

jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: class Ratelimit {
    static slidingWindow() {
      return { type: 'sliding' };
    }
    limit = limitMock;
    constructor() {}
  },
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status,
      body,
      headers: new Map<string, string>(),
    }),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('rate-limit', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    limitMock.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('disables rate limiters when Redis is not configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const mod = await import('@/lib/rate-limit');
    expect(mod.rateLimiters.auth).toBeNull();

    const request = {
      headers: new Map<string, string>(),
      nextUrl: { pathname: '/api/test' },
    } as any;

    const result = await mod.applyRateLimit(request, null);
    expect(result).toMatchObject({ success: true });
  });

  it('returns limit metadata when limiter is active', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';

    limitMock.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 100,
    });

    const mod = await import('@/lib/rate-limit');
    const request = {
      headers: new Map([['x-forwarded-for', '1.2.3.4']]),
      nextUrl: { pathname: '/api/test' },
    } as any;

    const result = await mod.applyRateLimit(request, mod.rateLimiters.api, 'user-1');
    expect(result).toEqual({ success: true, limit: 5, remaining: 4, reset: 100 });
  });

  it('creates rate limit response with headers', async () => {
    const mod = await import('@/lib/rate-limit');
    const response = mod.createRateLimitResponse(10, 0, 123);
    expect(response.status).toBe(429);
  });
});
