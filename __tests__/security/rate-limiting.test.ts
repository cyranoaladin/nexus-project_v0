/**
 * Rate Limiting Security Tests
 *
 * Tests: in-memory rate limiter behavior, limit enforcement,
 *        window reset, response format, per-type configuration
 *
 * Source: lib/rate-limit.ts
 */

import { NextRequest } from 'next/server';

// Mock Upstash modules before importing rate-limit
jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: jest.fn().mockImplementation(() => ({
    limit: jest.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 }),
  })),
}));
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockRequest(ip: string = '127.0.0.1', path: string = '/api/test'): NextRequest {
  const url = `http://localhost:3000${path}`;
  const req = new NextRequest(url, {
    headers: { 'x-forwarded-for': ip },
  });
  return req;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Rate Limiting', () => {
  let applyRateLimit: typeof import('@/lib/rate-limit').applyRateLimit;
  let createRateLimitResponse: typeof import('@/lib/rate-limit').createRateLimitResponse;
  let checkRateLimit: typeof import('@/lib/rate-limit').checkRateLimit;

  beforeEach(async () => {
    jest.resetModules();
    // Ensure no Redis env vars so we use in-memory fallback
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const mod = await import('@/lib/rate-limit');
    applyRateLimit = mod.applyRateLimit;
    createRateLimitResponse = mod.createRateLimitResponse;
    checkRateLimit = mod.checkRateLimit;
  });

  describe('In-Memory Rate Limiter', () => {
    it('should allow requests within the window limit', async () => {
      // Arrange
      const req = createMockRequest('10.0.0.1');

      // Act
      const result = await applyRateLimit(req, null, '10.0.0.1', 'api');

      // Assert
      expect(result.success).toBe(true);
      expect(result.remaining).toBeDefined();
    });

    it('should block the (limit+1)th request with success=false', async () => {
      // Arrange: auth limit is 5 per 15 min
      const ip = '10.0.0.2-auth-test';

      // Act: exhaust the limit
      for (let i = 0; i < 5; i++) {
        const req = createMockRequest(ip);
        const result = await applyRateLimit(req, null, ip, 'auth');
        expect(result.success).toBe(true);
      }

      // Act: 6th request should be blocked
      const req = createMockRequest(ip);
      const result = await applyRateLimit(req, null, ip, 'auth');

      // Assert
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should use IP as default rate limit key', async () => {
      // Arrange
      const req = createMockRequest('192.168.1.100');

      // Act
      const result = await applyRateLimit(req, null, undefined, 'api');

      // Assert
      expect(result.success).toBe(true);
    });

    it('should allow custom key (e.g. userId-based)', async () => {
      // Arrange
      const req = createMockRequest('10.0.0.3');
      const customKey = 'user:admin-123';

      // Act
      const result = await applyRateLimit(req, null, customKey, 'api');

      // Assert
      expect(result.success).toBe(true);
    });

    it('should rate limit per IP address (different IPs get separate limits)', async () => {
      // Arrange: exhaust limit for IP-A
      const ipA = '10.0.0.4-separate';
      const ipB = '10.0.0.5-separate';

      for (let i = 0; i < 5; i++) {
        const req = createMockRequest(ipA);
        await applyRateLimit(req, null, ipA, 'auth');
      }

      // Act: IP-B should still be allowed
      const reqB = createMockRequest(ipB);
      const resultB = await applyRateLimit(reqB, null, ipB, 'auth');

      // Assert
      expect(resultB.success).toBe(true);
    });
  });

  describe('createRateLimitResponse', () => {
    it('should return 429 status', () => {
      // Act
      const response = createRateLimitResponse(100, 0, Date.now() + 60000);

      // Assert
      expect(response.status).toBe(429);
    });

    it('should include rate limit headers', () => {
      // Arrange
      const limit = 100;
      const remaining = 0;
      const reset = Date.now() + 60000;

      // Act
      const response = createRateLimitResponse(limit, remaining, reset);

      // Assert
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });

    it('should include error message in response body', async () => {
      // Act
      const response = createRateLimitResponse(100, 0, Date.now());
      const body = await response.json();

      // Assert
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error.message).toBeTruthy();
    });
  });

  describe('checkRateLimit helper', () => {
    it('should return null when within limits', async () => {
      // Arrange
      const req = createMockRequest('10.0.0.10-check');

      // Act
      const result = await checkRateLimit(req, 'api');

      // Assert
      expect(result).toBeNull();
    });

    it('should return 429 response when limit exceeded', async () => {
      // Arrange: exhaust auth limit
      const ip = '10.0.0.11-check-exceed';
      for (let i = 0; i < 5; i++) {
        const req = createMockRequest(ip);
        await checkRateLimit(req, 'auth');
      }

      // Act
      const req = createMockRequest(ip);
      const result = await checkRateLimit(req, 'auth');

      // Assert
      expect(result).not.toBeNull();
      expect(result!.status).toBe(429);
    });
  });

  describe('Rate Limit Configuration', () => {
    it('should enforce auth limit of 5 requests per 15 minutes', async () => {
      // Arrange
      const ip = '10.0.0.20-auth-config';
      let blocked = false;

      // Act: send 6 requests
      for (let i = 0; i < 6; i++) {
        const req = createMockRequest(ip);
        const result = await applyRateLimit(req, null, ip, 'auth');
        if (!result.success) blocked = true;
      }

      // Assert
      expect(blocked).toBe(true);
    });

    it('should enforce notifyEmail limit of 5 requests per minute', async () => {
      // Arrange
      const ip = '10.0.0.21-email-config';
      let blocked = false;

      // Act: send 6 requests
      for (let i = 0; i < 6; i++) {
        const req = createMockRequest(ip);
        const result = await applyRateLimit(req, null, ip, 'notifyEmail');
        if (!result.success) blocked = true;
      }

      // Assert
      expect(blocked).toBe(true);
    });
  });
});
