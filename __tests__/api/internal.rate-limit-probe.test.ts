import { NextRequest, NextResponse } from 'next/server';
import { GET } from '@/app/api/internal/rate-limit-probe/route';
import { enforcePolicy } from '@/lib/rbac';
import { _resetStoreForTests } from '@/lib/rate-limit';

jest.mock('@/lib/rbac', () => ({
  enforcePolicy: jest.fn(),
}));

function makeRequest(ip = '203.0.113.42'): NextRequest {
  return new NextRequest('http://localhost:3000/api/internal/rate-limit-probe', {
    headers: {
      'x-forwarded-for': ip,
    },
  });
}

describe('GET /api/internal/rate-limit-probe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetStoreForTests();
    delete process.env.RATE_LIMIT_DISABLE;
    delete process.env.REDIS_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    (enforcePolicy as jest.Mock).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
  });

  it('requires the internal admin policy before probing rate limits', async () => {
    (enforcePolicy as jest.Mock).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
  });

  it('returns safe runtime metadata without secrets when under limit', async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      probe: 'rate-limit',
      runtime: {
        mode: 'memory',
        distributed: false,
        goLiveLarge: 'blocked',
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/token|secret|password|cookie/i);
  });

  it('returns 429 after the probe limit is exceeded for the same key', async () => {
    const request = makeRequest();
    let response = await GET(request);

    for (let i = 0; i < 5; i += 1) {
      response = await GET(request);
    }

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeTruthy();
  });
});
