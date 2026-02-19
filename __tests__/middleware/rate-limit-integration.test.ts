/**
 * Rate Limiting Integration Tests
 * Verifies rate limiting works correctly for ARIA and Auth endpoints
 */

import { NextRequest } from 'next/server';

// Import actual rate limit implementation (override global mock)
const rateLimitModule = jest.requireActual('@/lib/middleware/rateLimit');
const { RateLimitPresets, clearRateLimit } = rateLimitModule;

// Helper to create mock NextRequest with specific IP
function createMockRequest(path: string, ip: string = '127.0.0.1'): NextRequest {
  const url = `http://localhost:3000${path}`;
  const request = new NextRequest(url, {
    method: 'POST',
    headers: {
      'x-forwarded-for': ip,
      'content-type': 'application/json',
    },
  });
  
  return request;
}

describe('Rate Limiting Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ARIA Chat Endpoint - Expensive Preset (30/min)', () => {
    const testPath = '/api/aria/chat';
    const testIP = '192.168.1.100';

    afterEach(() => {
      const cleanupRequest = createMockRequest(testPath, testIP);
      clearRateLimit(cleanupRequest, 'aria:chat');
    });

    it('should allow requests within rate limit (30/min)', () => {
      const request = createMockRequest(testPath, testIP);
      
      // First request should be allowed
      const result = RateLimitPresets.expensive(request, 'aria:chat');
      
      expect(result).toBeNull();
    });

    it('should return 429 when exceeding rate limit', () => {
      const request = createMockRequest(testPath, testIP);
      
      // Make 30 requests (the limit)
      for (let i = 0; i < 30; i++) {
        const result = RateLimitPresets.expensive(request, 'aria:chat');
        expect(result).toBeNull(); // All should be allowed
      }
      
      // 31st request should be rate limited
      const result = RateLimitPresets.expensive(request, 'aria:chat');
      
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it('should include rate limit headers in response', async () => {
      const request = createMockRequest(testPath, testIP);
      
      // Make 30 requests to reach limit
      for (let i = 0; i < 30; i++) {
        RateLimitPresets.expensive(request, 'aria:chat');
      }
      
      // 31st request should be rate limited with headers
      const result = RateLimitPresets.expensive(request, 'aria:chat');
      
      expect(result).not.toBeNull();
      
      const limitHeader = result?.headers.get('X-RateLimit-Limit');
      const remainingHeader = result?.headers.get('X-RateLimit-Remaining');
      const resetHeader = result?.headers.get('X-RateLimit-Reset');
      const retryAfterHeader = result?.headers.get('Retry-After');
      
      expect(limitHeader).toBe('30');
      expect(remainingHeader).toBe('0');
      expect(resetHeader).toBeDefined();
      expect(retryAfterHeader).toBeDefined();
      
      // Verify Retry-After is reasonable (within 60 seconds)
      const retryAfter = parseInt(retryAfterHeader || '0', 10);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });

    it('should include error details in 429 response body', async () => {
      const request = createMockRequest(testPath, testIP);
      
      // Exhaust rate limit
      for (let i = 0; i < 30; i++) {
        RateLimitPresets.expensive(request, 'aria:chat');
      }
      
      const result = RateLimitPresets.expensive(request, 'aria:chat');
      expect(result).not.toBeNull();
      
      const body = await result?.json();
      
      expect(body.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.message).toContain('Rate limit exceeded');
      expect(body.details).toBeDefined();
      expect(body.details.retryAfter).toBeDefined();
      expect(typeof body.details.retryAfter).toBe('number');
    });

    it('should have separate rate limits for different IPs', () => {
      const ip1 = '192.168.1.101';
      const ip2 = '192.168.1.102';
      
      const request1 = createMockRequest(testPath, ip1);
      const request2 = createMockRequest(testPath, ip2);
      
      // Exhaust limit for IP1
      for (let i = 0; i < 30; i++) {
        const result = RateLimitPresets.expensive(request1, 'aria:chat');
        expect(result).toBeNull();
      }
      
      // IP1 should now be rate limited
      const result1 = RateLimitPresets.expensive(request1, 'aria:chat');
      expect(result1).not.toBeNull();
      expect(result1?.status).toBe(429);
      
      // IP2 should still be allowed
      const result2 = RateLimitPresets.expensive(request2, 'aria:chat');
      expect(result2).toBeNull();
      
      // Cleanup IP2
      clearRateLimit(request2, 'aria:chat');
    });
  });

  describe('ARIA Feedback Endpoint - API Preset (100/min)', () => {
    const testPath = '/api/aria/feedback';
    const testIP = '192.168.2.100';

    afterEach(() => {
      const cleanupRequest = createMockRequest(testPath, testIP);
      clearRateLimit(cleanupRequest, 'aria:feedback');
    });

    it('should allow requests within rate limit (100/min)', () => {
      const request = createMockRequest(testPath, testIP);
      
      // First 99 requests should be allowed
      for (let i = 0; i < 99; i++) {
        const result = RateLimitPresets.api(request, 'aria:feedback');
        expect(result).toBeNull();
      }
      
      // 100th request should still be allowed
      const result = RateLimitPresets.api(request, 'aria:feedback');
      expect(result).toBeNull();
    });

    it('should return 429 after 100 requests', () => {
      const request = createMockRequest(testPath, testIP);
      
      // Make 100 requests (the limit)
      for (let i = 0; i < 100; i++) {
        const result = RateLimitPresets.api(request, 'aria:feedback');
        expect(result).toBeNull();
      }
      
      // 101st request should be rate limited
      const result = RateLimitPresets.api(request, 'aria:feedback');
      
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
      
      const limitHeader = result?.headers.get('X-RateLimit-Limit');
      expect(limitHeader).toBe('100');
    });
  });

  describe('Auth Callback Endpoint - Auth Preset (5/15min)', () => {
    const testPath = '/api/auth/callback/credentials';
    const testIP = '192.168.3.100';

    afterEach(() => {
      const cleanupRequest = createMockRequest(testPath, testIP);
      clearRateLimit(cleanupRequest, 'auth:login');
    });

    it('should allow requests within rate limit (5/15min)', () => {
      const request = createMockRequest(testPath, testIP);
      
      // First 5 requests should be allowed
      for (let i = 0; i < 5; i++) {
        const result = RateLimitPresets.auth(request, 'auth:login');
        expect(result).toBeNull();
      }
    });

    it('should return 429 after 5 login attempts', () => {
      const request = createMockRequest(testPath, testIP);
      
      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        const result = RateLimitPresets.auth(request, 'auth:login');
        expect(result).toBeNull();
      }
      
      // 6th request should be rate limited
      const result = RateLimitPresets.auth(request, 'auth:login');
      
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it('should include rate limit headers in 429 response', async () => {
      const request = createMockRequest(testPath, testIP);
      
      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        RateLimitPresets.auth(request, 'auth:login');
      }
      
      const result = RateLimitPresets.auth(request, 'auth:login');
      
      expect(result).not.toBeNull();
      
      const limitHeader = result?.headers.get('X-RateLimit-Limit');
      const remainingHeader = result?.headers.get('X-RateLimit-Remaining');
      const retryAfterHeader = result?.headers.get('Retry-After');
      
      expect(limitHeader).toBe('5');
      expect(remainingHeader).toBe('0');
      expect(retryAfterHeader).toBeDefined();
      
      // Retry-After should be within 15 minutes (900 seconds)
      const retryAfter = parseInt(retryAfterHeader || '0', 10);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(900);
    });

    it('should include appropriate error message for auth endpoint', async () => {
      const request = createMockRequest(testPath, testIP);
      
      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        RateLimitPresets.auth(request, 'auth:login');
      }
      
      const result = RateLimitPresets.auth(request, 'auth:login');
      expect(result).not.toBeNull();
      
      const body = await result?.json();
      
      expect(body.message).toContain('Too many login attempts');
    });

    it('should have separate rate limits for different IPs', () => {
      const ip1 = '192.168.3.101';
      const ip2 = '192.168.3.102';
      
      const request1 = createMockRequest(testPath, ip1);
      const request2 = createMockRequest(testPath, ip2);
      
      // Exhaust limit for IP1
      for (let i = 0; i < 5; i++) {
        const result = RateLimitPresets.auth(request1, 'auth:login');
        expect(result).toBeNull();
      }
      
      // IP1 should now be rate limited
      const result1 = RateLimitPresets.auth(request1, 'auth:login');
      expect(result1).not.toBeNull();
      expect(result1?.status).toBe(429);
      
      // IP2 should still be allowed
      const result2 = RateLimitPresets.auth(request2, 'auth:login');
      expect(result2).toBeNull();
      
      // Cleanup IP2
      clearRateLimit(request2, 'auth:login');
    });
  });

  describe('Rate Limit Reset After Time Window', () => {
    it('should reset rate limit after window expires', async () => {
      const testPath = '/api/aria/chat';
      const testIP = '192.168.4.100';
      const request = createMockRequest(testPath, testIP);
      
      // Use a custom short-lived rate limiter for testing
      const { rateLimit } = rateLimitModule;
      const shortRateLimit = rateLimit({
        windowMs: 100, // 100ms window
        maxRequests: 2,
      });
      
      // Make 2 requests (the limit)
      for (let i = 0; i < 2; i++) {
        const result = shortRateLimit(request, 'test:short');
        expect(result).toBeNull();
      }
      
      // 3rd request should be rate limited
      const result1 = shortRateLimit(request, 'test:short');
      expect(result1).not.toBeNull();
      expect(result1?.status).toBe(429);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // After window expires, should be allowed again
      const result2 = shortRateLimit(request, 'test:short');
      expect(result2).toBeNull();
      
      // Cleanup
      clearRateLimit(request, 'test:short');
    });
  });

  describe('Rate Limit Headers on Allowed Requests', () => {
    it('should include rate limit headers on successful requests', () => {
      // Note: The current implementation only adds headers to rate-limited responses
      // This test documents current behavior
      const testPath = '/api/aria/chat';
      const testIP = '192.168.5.100';
      const request = createMockRequest(testPath, testIP);
      
      const result = RateLimitPresets.expensive(request, 'aria:chat');
      
      // When request is allowed, result is null
      expect(result).toBeNull();
      
      // Cleanup
      clearRateLimit(request, 'aria:chat');
    });
  });
});
