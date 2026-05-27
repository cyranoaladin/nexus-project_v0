/**
 * Facade compatibility tests for lib/middleware/rateLimit.ts
 *
 * Verifies the deprecated facade still works for existing routes
 * that import RateLimitPresets from '@/lib/middleware/rateLimit'.
 */

import { NextRequest } from 'next/server';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { _resetStoreForTests } from '@/lib/rate-limit';

function makeRequest(ip: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('middleware rateLimit facade', () => {
  beforeEach(() => {
    _resetStoreForTests();
  });

  it('rateLimit() factory returns a function', () => {
    const limiter = rateLimit({ windowMs: 1000, maxRequests: 2 });
    expect(typeof limiter).toBe('function');
  });

  it('allows requests under the limit', () => {
    const request = makeRequest('1.2.3.4');
    const res1 = RateLimitPresets.api(request, 'test');
    expect(res1).toBeNull();
  });

  it('RateLimitPresets.auth blocks after 5 requests', () => {
    const request = makeRequest('1.2.3.5');
    for (let i = 0; i < 5; i++) {
      const res = RateLimitPresets.auth(request, 'facade-auth');
      expect(res).toBeNull();
    }
    const blocked = RateLimitPresets.auth(request, 'facade-auth');
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it('different key prefixes are independent', () => {
    const request = makeRequest('1.2.3.6');
    // Exhaust auth with prefix A
    for (let i = 0; i < 5; i++) {
      RateLimitPresets.auth(request, 'routeA');
    }
    expect(RateLimitPresets.auth(request, 'routeA')).not.toBeNull();
    // Prefix B should still work
    expect(RateLimitPresets.auth(request, 'routeB')).toBeNull();
  });
});
