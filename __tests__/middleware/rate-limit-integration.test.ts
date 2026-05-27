/**
 * Rate Limiting Integration Tests
 * Verifies rate limiting works correctly via the facade and unified system.
 */

import { NextRequest } from 'next/server';
import { _resetStoreForTests } from '@/lib/rate-limit';
import { RateLimitPresets } from '@/lib/middleware/rateLimit';

function createMockRequest(path: string, ip: string = '127.0.0.1'): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: {
      'x-forwarded-for': ip,
      'content-type': 'application/json',
    },
  });
}

describe('Rate Limiting Integration Tests', () => {
  beforeEach(() => {
    _resetStoreForTests();
  });

  describe('Expensive Preset (10 req/hour)', () => {
    const testPath = '/api/aria/chat';
    const testIP = '192.168.1.100';

    it('should allow requests within rate limit', () => {
      const request = createMockRequest(testPath, testIP);
      const result = RateLimitPresets.expensive(request, 'aria:chat');
      expect(result).toBeNull();
    });

    it('should return 429 when exceeding rate limit', () => {
      const request = createMockRequest(testPath, testIP);

      for (let i = 0; i < 10; i++) {
        const result = RateLimitPresets.expensive(request, 'aria:chat');
        expect(result).toBeNull();
      }

      const result = RateLimitPresets.expensive(request, 'aria:chat');
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it('should include rate limit headers in 429 response', () => {
      const request = createMockRequest(testPath, testIP);

      for (let i = 0; i < 10; i++) {
        RateLimitPresets.expensive(request, 'aria:chat');
      }

      const result = RateLimitPresets.expensive(request, 'aria:chat');
      expect(result).not.toBeNull();

      expect(result?.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(result?.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(result?.headers.get('X-RateLimit-Reset')).toBeDefined();

      const retryAfter = parseInt(result?.headers.get('Retry-After') || '0', 10);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(3600); // 1 hour window
    });

    it('should include error details in 429 response body', async () => {
      const request = createMockRequest(testPath, testIP);

      for (let i = 0; i < 10; i++) {
        RateLimitPresets.expensive(request, 'aria:chat');
      }

      const result = RateLimitPresets.expensive(request, 'aria:chat');
      expect(result).not.toBeNull();

      const body = await result?.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error.message).toBeTruthy();
    });

    it('should have separate rate limits for different IPs', () => {
      const ip1 = '192.168.1.101';
      const ip2 = '192.168.1.102';

      const request1 = createMockRequest(testPath, ip1);
      const request2 = createMockRequest(testPath, ip2);

      for (let i = 0; i < 10; i++) {
        expect(RateLimitPresets.expensive(request1, 'aria:chat')).toBeNull();
      }

      expect(RateLimitPresets.expensive(request1, 'aria:chat')).not.toBeNull();
      expect(RateLimitPresets.expensive(request2, 'aria:chat')).toBeNull();
    });
  });

  describe('API Preset (60 req/min)', () => {
    const testPath = '/api/aria/feedback';
    const testIP = '192.168.2.100';

    it('should allow requests within rate limit', () => {
      const request = createMockRequest(testPath, testIP);

      for (let i = 0; i < 60; i++) {
        const result = RateLimitPresets.api(request, 'aria:feedback');
        expect(result).toBeNull();
      }
    });

    it('should return 429 after 60 requests', () => {
      const request = createMockRequest(testPath, testIP);

      for (let i = 0; i < 60; i++) {
        expect(RateLimitPresets.api(request, 'aria:feedback')).toBeNull();
      }

      const result = RateLimitPresets.api(request, 'aria:feedback');
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
      expect(result?.headers.get('X-RateLimit-Limit')).toBe('60');
    });
  });

  describe('Auth Preset (5 req/15min)', () => {
    const testPath = '/api/auth/callback/credentials';
    const testIP = '192.168.3.100';

    it('should allow requests within rate limit', () => {
      const request = createMockRequest(testPath, testIP);

      for (let i = 0; i < 5; i++) {
        expect(RateLimitPresets.auth(request, 'auth:login')).toBeNull();
      }
    });

    it('should return 429 after 5 login attempts', () => {
      const request = createMockRequest(testPath, testIP);

      for (let i = 0; i < 5; i++) {
        expect(RateLimitPresets.auth(request, 'auth:login')).toBeNull();
      }

      const result = RateLimitPresets.auth(request, 'auth:login');
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it('should include rate limit headers in 429 response', () => {
      const request = createMockRequest(testPath, testIP);

      for (let i = 0; i < 5; i++) {
        RateLimitPresets.auth(request, 'auth:login');
      }

      const result = RateLimitPresets.auth(request, 'auth:login');
      expect(result).not.toBeNull();

      expect(result?.headers.get('X-RateLimit-Limit')).toBe('5');
      expect(result?.headers.get('X-RateLimit-Remaining')).toBe('0');

      const retryAfter = parseInt(result?.headers.get('Retry-After') || '0', 10);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(900); // 15 min
    });

    it('should have separate rate limits for different IPs', () => {
      const ip1 = '192.168.3.101';
      const ip2 = '192.168.3.102';

      const request1 = createMockRequest(testPath, ip1);
      const request2 = createMockRequest(testPath, ip2);

      for (let i = 0; i < 5; i++) {
        expect(RateLimitPresets.auth(request1, 'auth:login')).toBeNull();
      }

      expect(RateLimitPresets.auth(request1, 'auth:login')).not.toBeNull();
      expect(RateLimitPresets.auth(request2, 'auth:login')).toBeNull();
    });
  });

  describe('Allowed Requests', () => {
    it('should return null when request is allowed', () => {
      const request = createMockRequest('/api/aria/chat', '192.168.5.100');
      const result = RateLimitPresets.expensive(request, 'aria:chat');
      expect(result).toBeNull();
    });
  });
});
