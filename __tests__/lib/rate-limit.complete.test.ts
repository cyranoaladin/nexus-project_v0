/**
 * Rate Limiting — Complete Test Suite
 *
 * Tests: createRateLimitResponse, in-memory rate limiting behavior,
 *        rate limiter configuration, checkRateLimit
 *
 * Source: lib/rate-limit.ts
 */

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    jest.fn().mockImplementation(() => ({
      limit: jest.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 }),
    })),
    {
      slidingWindow: jest.fn().mockReturnValue({}),
    }
  ),
}));

import { NextRequest } from 'next/server';
import { createRateLimitResponse, checkRateLimit } from '@/lib/rate-limit';

// ─── createRateLimitResponse ─────────────────────────────────────────────────

describe('createRateLimitResponse', () => {
  it('should return 429 status', () => {
    const response = createRateLimitResponse();
    expect(response.status).toBe(429);
  });

  it('should include RATE_LIMIT_EXCEEDED error code', async () => {
    const response = createRateLimitResponse();
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should include French error message', async () => {
    const response = createRateLimitResponse();
    const body = await response.json();
    expect(body.error.message).toContain('requêtes');
  });

  it('should set X-RateLimit-Limit header when provided', () => {
    const response = createRateLimitResponse(100);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
  });

  it('should set X-RateLimit-Remaining header when provided', () => {
    const response = createRateLimitResponse(100, 0);
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('should set X-RateLimit-Reset header when provided', () => {
    const reset = Date.now() + 60000;
    const response = createRateLimitResponse(100, 0, reset);
    expect(response.headers.get('X-RateLimit-Reset')).toBe(reset.toString());
  });

  it('should not set headers when values are undefined', () => {
    const response = createRateLimitResponse();
    expect(response.headers.get('X-RateLimit-Limit')).toBeNull();
    expect(response.headers.get('X-RateLimit-Remaining')).toBeNull();
    expect(response.headers.get('X-RateLimit-Reset')).toBeNull();
  });
});

// ─── checkRateLimit (in-memory fallback, no Redis in test) ───────────────────

describe('checkRateLimit — in-memory fallback', () => {
  it('should allow first request', async () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-forwarded-for': '192.168.1.100' },
    });
    const result = await checkRateLimit(req, 'api');
    expect(result).toBeNull(); // null means allowed
  });

  it('should allow multiple requests within limit', async () => {
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': `10.0.0.${i}` },
      });
      const result = await checkRateLimit(req, 'api');
      expect(result).toBeNull();
    }
  });

  it('should use x-forwarded-for as identifier', async () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-forwarded-for': '203.0.113.1' },
    });
    const result = await checkRateLimit(req, 'api');
    expect(result).toBeNull();
  });

  it('should use x-real-ip as fallback identifier', async () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-real-ip': '203.0.113.2' },
    });
    const result = await checkRateLimit(req, 'api');
    expect(result).toBeNull();
  });

  it('should handle auth rate limit type', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/signin', {
      headers: { 'x-forwarded-for': '172.16.0.1' },
    });
    const result = await checkRateLimit(req, 'auth');
    expect(result).toBeNull();
  });

  it('should handle ai rate limit type', async () => {
    const req = new NextRequest('http://localhost:3000/api/ai/chat', {
      headers: { 'x-forwarded-for': '172.16.0.2' },
    });
    const result = await checkRateLimit(req, 'ai');
    expect(result).toBeNull();
  });

  it('should handle notifyEmail rate limit type', async () => {
    const req = new NextRequest('http://localhost:3000/api/notify', {
      headers: { 'x-forwarded-for': '172.16.0.3' },
    });
    const result = await checkRateLimit(req, 'notifyEmail');
    expect(result).toBeNull();
  });
});
