/**
 * PII Redaction for Logging — Test Suite
 *
 * Tests: lib/security/redact-for-logging.ts
 *
 * Ensures sensitive data (email, phone, token, password, etc.)
 * is never present in log output.
 */

import { redactForLogging } from '@/lib/security/redact-for-logging';

const REDACTED = '[REDACTED]';

describe('redactForLogging', () => {
  describe('email redaction', () => {
    it('redacts email field', () => {
      const result = redactForLogging({ email: 'john@example.com', action: 'login' });
      expect(result.email).toBe(REDACTED);
      expect(result.action).toBe('login');
    });

    it('redacts customerEmail field', () => {
      const result = redactForLogging({ customerEmail: 'parent@test.com' });
      expect(result.customerEmail).toBe(REDACTED);
    });

    it('redacts parentEmail field', () => {
      const result = redactForLogging({ parentEmail: 'parent@test.com' });
      expect(result.parentEmail).toBe(REDACTED);
    });
  });

  describe('phone redaction', () => {
    it('redacts phone field', () => {
      const result = redactForLogging({ phone: '+21612345678' });
      expect(result.phone).toBe(REDACTED);
    });

    it('redacts parentPhone field', () => {
      const result = redactForLogging({ parentPhone: '+21698765432' });
      expect(result.parentPhone).toBe(REDACTED);
    });
  });

  describe('token and secret redaction', () => {
    it('redacts token field', () => {
      const result = redactForLogging({ token: 'abc123xyz' });
      expect(result.token).toBe(REDACTED);
    });

    it('redacts authorization field', () => {
      const result = redactForLogging({ authorization: 'Bearer xyz' });
      expect(result.authorization).toBe(REDACTED);
    });

    it('redacts cookie field', () => {
      const result = redactForLogging({ cookie: 'session=abc' });
      expect(result.cookie).toBe(REDACTED);
    });

    it('redacts password field', () => {
      const result = redactForLogging({ password: 'hunter2' });
      expect(result.password).toBe(REDACTED);
    });

    it('redacts secret field', () => {
      const result = redactForLogging({ secret: 'webhook-secret-value' });
      expect(result.secret).toBe(REDACTED);
    });

    it('redacts signature field', () => {
      const result = redactForLogging({ signature: 'hmac-sha256-value' });
      expect(result.signature).toBe(REDACTED);
    });

    it('redacts apiKey / api_key fields', () => {
      const result = redactForLogging({ apiKey: 'key1', api_key: 'key2' });
      expect(result.apiKey).toBe(REDACTED);
      expect(result.api_key).toBe(REDACTED);
    });
  });

  describe('nested objects', () => {
    it('redacts nested sensitive fields', () => {
      const result = redactForLogging({
        user: { email: 'test@test.com', name: 'John' },
        status: 'ok',
      });
      expect((result.user as Record<string, unknown>).email).toBe(REDACTED);
      expect((result.user as Record<string, unknown>).name).toBe('John');
    });

    it('handles deeply nested objects with depth limit', () => {
      const deep = { a: { b: { c: { d: { e: { email: 'deep@test.com' } } } } } };
      const result = redactForLogging(deep);
      // Should handle up to reasonable depth without crashing
      expect(result).toBeDefined();
    });
  });

  describe('arrays', () => {
    it('redacts sensitive fields inside arrays', () => {
      const result = redactForLogging({
        users: [
          { email: 'a@test.com', id: '1' },
          { email: 'b@test.com', id: '2' },
        ],
      });
      const users = result.users as Array<Record<string, unknown>>;
      expect(users[0].email).toBe(REDACTED);
      expect(users[0].id).toBe('1');
      expect(users[1].email).toBe(REDACTED);
    });
  });

  describe('circular references', () => {
    it('handles circular references without crashing', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj;
      const result = redactForLogging(obj);
      expect(result.name).toBe('test');
      expect(result.self).toBe('[Circular]');
    });
  });

  describe('Error objects', () => {
    it('extracts and preserves error name and message', () => {
      const err = new Error('Something failed');
      const result = redactForLogging({ err });
      const redactedErr = result.err as Record<string, unknown>;
      expect(redactedErr.name).toBe('Error');
      expect(redactedErr.message).toBe('Something failed');
    });
  });

  describe('long strings', () => {
    it('truncates very long string values', () => {
      const longStr = 'x'.repeat(2000);
      const result = redactForLogging({ data: longStr });
      expect((result.data as string).length).toBeLessThan(2000);
      expect((result.data as string)).toContain('[truncated]');
    });
  });

  describe('non-PII passthrough', () => {
    it('preserves safe fields unchanged', () => {
      const data = {
        requestId: 'req-123',
        action: 'READ',
        resourceType: 'DOCUMENT',
        reasonCode: 'FORBIDDEN',
        statusCode: 403,
        timestamp: '2026-07-11T12:00:00Z',
      };
      const result = redactForLogging(data);
      expect(result).toEqual(data);
    });
  });

  describe('no mutation', () => {
    it('does not mutate the original object', () => {
      const original = { email: 'test@test.com', name: 'John' };
      const originalCopy = { ...original };
      redactForLogging(original);
      expect(original).toEqual(originalCopy);
    });
  });

  describe('case insensitivity', () => {
    it('redacts regardless of casing', () => {
      const result = redactForLogging({
        EMAIL: 'test@test.com',
        Password: 'secret',
        API_KEY: 'key123',
      });
      expect(result.EMAIL).toBe(REDACTED);
      expect(result.Password).toBe(REDACTED);
      expect(result.API_KEY).toBe(REDACTED);
    });
  });

  describe('primitives and edge cases', () => {
    it('handles null input', () => {
      expect(redactForLogging(null as unknown as Record<string, unknown>)).toEqual({});
    });

    it('handles undefined input', () => {
      expect(redactForLogging(undefined as unknown as Record<string, unknown>)).toEqual({});
    });

    it('handles empty object', () => {
      expect(redactForLogging({})).toEqual({});
    });

    it('handles string input', () => {
      expect(redactForLogging('raw string' as unknown as Record<string, unknown>)).toEqual({});
    });
  });
});
