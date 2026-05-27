/**
 * Rate Limiting Security Tests
 *
 * Validates rate limit enforcement, per-IP isolation, window behavior,
 * response format, and per-preset configuration.
 *
 * Source: lib/rate-limit/
 */

import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  rateLimitResponse,
  guardRateLimit,
  _resetStoreForTests,
  PRESETS,
} from '@/lib/rate-limit';

function createMockRequest(ip: string = '127.0.0.1'): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('Rate Limiting', () => {
  beforeEach(() => {
    _resetStoreForTests();
  });

  describe('In-Memory Rate Limiter', () => {
    it('should allow requests within the window limit', () => {
      const req = createMockRequest('10.0.0.1');
      const result = checkRateLimit(req, { preset: 'api' });
      expect(result.success).toBe(true);
      expect(result.remaining).toBeDefined();
    });

    it('should block the (limit+1)th request with success=false', () => {
      const ip = '10.0.0.2-auth-test';
      for (let i = 0; i < 5; i++) {
        const req = createMockRequest(ip);
        const result = checkRateLimit(req, { preset: 'auth' });
        expect(result.success).toBe(true);
      }
      const req = createMockRequest(ip);
      const result = checkRateLimit(req, { preset: 'auth' });
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should use IP as default rate limit key', () => {
      const req = createMockRequest('192.168.1.100');
      const result = checkRateLimit(req, { preset: 'api' });
      expect(result.success).toBe(true);
    });

    it('should allow userId-based keying', () => {
      const req = createMockRequest('10.0.0.3');
      const result = checkRateLimit(req, { preset: 'api', userId: 'admin-123' });
      expect(result.success).toBe(true);
    });

    it('should rate limit per IP address (different IPs get separate limits)', () => {
      const ipA = '10.0.0.4-separate';
      const ipB = '10.0.0.5-separate';

      for (let i = 0; i < 5; i++) {
        const req = createMockRequest(ipA);
        checkRateLimit(req, { preset: 'auth' });
      }

      const reqB = createMockRequest(ipB);
      const resultB = checkRateLimit(reqB, { preset: 'auth' });
      expect(resultB.success).toBe(true);
    });
  });

  describe('rateLimitResponse', () => {
    it('should return 429 status', () => {
      const response = rateLimitResponse({
        success: false, limit: 100, remaining: 0,
        resetAt: Date.now() + 60000, retryAfter: 60,
      });
      expect(response.status).toBe(429);
    });

    it('should include rate limit headers', () => {
      const response = rateLimitResponse({
        success: false, limit: 100, remaining: 0,
        resetAt: Date.now() + 60000, retryAfter: 60,
      });
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('Retry-After')).toBe('60');
    });

    it('should include error message in response body', async () => {
      const response = rateLimitResponse({
        success: false, limit: 100, remaining: 0,
        resetAt: Date.now(), retryAfter: 0,
      });
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error.message).toBeTruthy();
    });
  });

  describe('guardRateLimit helper', () => {
    it('should return null when within limits', () => {
      const req = createMockRequest('10.0.0.10-check');
      const result = guardRateLimit(req, { preset: 'api' });
      expect(result).toBeNull();
    });

    it('should return 429 response when limit exceeded', () => {
      const ip = '10.0.0.11-check-exceed';
      for (let i = 0; i < 5; i++) {
        const req = createMockRequest(ip);
        guardRateLimit(req, { preset: 'auth' });
      }
      const req = createMockRequest(ip);
      const result = guardRateLimit(req, { preset: 'auth' });
      expect(result).not.toBeNull();
      expect(result!.status).toBe(429);
    });
  });

  describe('Rate Limit Configuration', () => {
    it('should enforce auth limit of 5 requests per 15 minutes', () => {
      const ip = '10.0.0.20-auth-config';
      let blocked = false;
      for (let i = 0; i < 6; i++) {
        const req = createMockRequest(ip);
        const result = checkRateLimit(req, { preset: 'auth' });
        if (!result.success) blocked = true;
      }
      expect(blocked).toBe(true);
    });

    it('should enforce notifyEmail limit of 5 requests per hour', () => {
      const ip = '10.0.0.21-email-config';
      let blocked = false;
      for (let i = 0; i < 6; i++) {
        const req = createMockRequest(ip);
        const result = checkRateLimit(req, { preset: 'notifyEmail' });
        if (!result.success) blocked = true;
      }
      expect(blocked).toBe(true);
    });

    it('all presets have positive limit and windowMs', () => {
      for (const [name, config] of Object.entries(PRESETS)) {
        expect(config.limit).toBeGreaterThan(0);
        expect(config.windowMs).toBeGreaterThan(0);
      }
    });
  });
});
