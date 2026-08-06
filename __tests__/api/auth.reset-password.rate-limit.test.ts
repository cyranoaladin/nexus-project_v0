import { NextRequest } from 'next/server';
import { _resetStoreForTests } from '@/lib/rate-limit';
import { POST } from '@/app/api/auth/reset-password/route';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/email', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

function makeRequest(ip = '198.51.100.30'): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({ email: 'user@example.com' }),
  });
}

describe('POST /api/auth/reset-password rate limiting', () => {
  beforeEach(() => {
    delete process.env.RATE_LIMIT_DISABLE;
    delete process.env.REDIS_URL;
    Object.assign(process.env, { NODE_ENV: 'test' });
    _resetStoreForTests();
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
    _resetStoreForTests();
  });

  it('returns 429 after the auth limit is exceeded', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest());
      expect(res.status).toBe(200);
    }

    const blocked = await POST(makeRequest());
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('rate-limits malformed JSON bodies by IP instead of bypassing both limiter scopes', async () => {
    const malformedRequest = (ip: string) => new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        'x-forwarded-for': ip,
      },
      body: '{not-valid-json',
    });

    // Malformed JSON must return 400 (validation-style), never a bare 500 —
    // and it must still consume the IP rate-limit budget so an attacker can't
    // send unlimited malformed bodies to dodge both password-reset scopes.
    for (let i = 0; i < 30; i++) {
      const res = await POST(malformedRequest('203.0.113.50'));
      expect(res.status).toBe(400);
    }

    const blocked = await POST(malformedRequest('203.0.113.50'));
    expect(blocked.status).toBe(429);
  });
});
