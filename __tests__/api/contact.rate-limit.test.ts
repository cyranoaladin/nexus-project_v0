import { _resetStoreForTests } from '@/lib/rate-limit';
import { POST } from '@/app/api/contact/route';

function makeRequest(body: Record<string, unknown>, ip = '198.51.100.20') {
  return new Request('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/contact rate limiting', () => {
  beforeEach(() => {
    _resetStoreForTests();
    delete process.env.RATE_LIMIT_DISABLE;
  });

  it('returns 429 after the public API limit is exceeded', async () => {
    const payload = { name: 'Alex', email: 'alex@example.com', message: 'Bonjour' };

    for (let i = 0; i < 60; i++) {
      const res = await POST(makeRequest(payload));
      expect(res.status).toBe(200);
    }

    const blocked = await POST(makeRequest(payload));
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
