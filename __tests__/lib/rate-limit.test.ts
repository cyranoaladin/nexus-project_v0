/**
 * Rate Limiting — Unit Tests
 *
 * Tests the unified rate-limit module (lib/rate-limit/).
 * No Upstash/Redis mocks needed — the unified system uses in-memory only.
 */

import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  rateLimitResponse,
  guardRateLimit,
  _resetStoreForTests,
} from '@/lib/rate-limit';

function makeRequest(ip: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('rate-limit', () => {
  beforeEach(() => {
    _resetStoreForTests();
  });

  it('allows first request (success=true)', () => {
    const req = makeRequest('1.2.3.4');
    const result = checkRateLimit(req, { preset: 'api' });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it('returns limit metadata on every request', () => {
    const req = makeRequest('1.2.3.5');
    const result = checkRateLimit(req, { preset: 'api' });
    expect(result.limit).toBe(60);
    expect(result.remaining).toBeDefined();
    expect(result.resetAt).toBeGreaterThan(0);
    expect(result.retryAfter).toBe(0);
  });

  it('blocks after limit is exceeded', () => {
    const req = makeRequest('1.2.3.6');
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(req, { preset: 'auth' });
      expect(r.success).toBe(true);
    }
    const blocked = checkRateLimit(req, { preset: 'auth' });
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('creates 429 response with headers', async () => {
    const result = {
      success: false as const,
      limit: 10,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfter: 60,
    };
    const response = rateLimitResponse(result);
    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('guardRateLimit returns null when allowed', () => {
    const req = makeRequest('1.2.3.7');
    expect(guardRateLimit(req, { preset: 'api' })).toBeNull();
  });

  it('guardRateLimit returns 429 when blocked', () => {
    const req = makeRequest('1.2.3.8');
    for (let i = 0; i < 5; i++) {
      guardRateLimit(req, { preset: 'auth' });
    }
    const result = guardRateLimit(req, { preset: 'auth' });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });
});
