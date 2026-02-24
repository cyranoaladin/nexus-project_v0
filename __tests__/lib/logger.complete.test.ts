/**
 * Logger — Complete Test Suite
 *
 * Tests: logger instance, createRequestLogger, sanitizeLogData
 *
 * Source: lib/logger.ts
 */

import { logger, createRequestLogger, sanitizeLogData } from '@/lib/logger';

// ─── logger instance ─────────────────────────────────────────────────────────

describe('logger', () => {
  it('should be a pino logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.child).toBe('function');
  });

  it('should have level set to "silent" in test environment', () => {
    expect(logger.level).toBe('silent');
  });
});

// ─── createRequestLogger ─────────────────────────────────────────────────────

describe('createRequestLogger', () => {
  it('should return a child logger with request context', () => {
    const reqLogger = createRequestLogger({
      requestId: 'req-123',
      method: 'GET',
      path: '/api/test',
    });
    expect(reqLogger).toBeDefined();
    expect(typeof reqLogger.info).toBe('function');
    expect(typeof reqLogger.error).toBe('function');
  });

  it('should include userId when provided', () => {
    const reqLogger = createRequestLogger({
      requestId: 'req-456',
      method: 'POST',
      path: '/api/admin/users',
      userId: 'user-1',
    });
    expect(reqLogger).toBeDefined();
  });

  it('should work without optional userId', () => {
    const reqLogger = createRequestLogger({
      requestId: 'req-789',
      method: 'DELETE',
      path: '/api/sessions/cancel',
    });
    expect(reqLogger).toBeDefined();
  });
});

// ─── sanitizeLogData ─────────────────────────────────────────────────────────

describe('sanitizeLogData', () => {
  it('should redact password fields', () => {
    const data = { email: 'test@example.com', password: 'secret123' };
    const sanitized = sanitizeLogData(data);
    expect(sanitized.email).toBe('test@example.com');
    expect(sanitized.password).toBe('[REDACTED]');
  });

  it('should redact token fields', () => {
    const data = { userId: 'user-1', authToken: 'abc123' };
    const sanitized = sanitizeLogData(data);
    expect(sanitized.userId).toBe('user-1');
    expect(sanitized.authToken).toBe('[REDACTED]');
  });

  it('should redact apiKey fields', () => {
    const data = { apiKey: 'sk-12345', name: 'test' };
    const sanitized = sanitizeLogData(data);
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.name).toBe('test');
  });

  it('should redact secret fields', () => {
    const data = { clientSecret: 'very-secret', id: '1' };
    const sanitized = sanitizeLogData(data);
    expect(sanitized.clientSecret).toBe('[REDACTED]');
    expect(sanitized.id).toBe('1');
  });

  it('should redact creditCard fields', () => {
    const data = { creditCardNumber: '4111111111111111' };
    const sanitized = sanitizeLogData(data);
    expect(sanitized.creditCardNumber).toBe('[REDACTED]');
  });

  it('should redact ssn fields', () => {
    const data = { ssnValue: '123-45-6789' };
    const sanitized = sanitizeLogData(data);
    expect(sanitized.ssnValue).toBe('[REDACTED]');
  });

  it('should be case-insensitive for sensitive key detection', () => {
    const data = { PASSWORD: 'secret', Token: 'abc', APIKEY: 'key' };
    const sanitized = sanitizeLogData(data);
    expect(sanitized.PASSWORD).toBe('[REDACTED]');
    expect(sanitized.Token).toBe('[REDACTED]');
    expect(sanitized.APIKEY).toBe('[REDACTED]');
  });

  it('should not modify non-sensitive fields', () => {
    const data = { email: 'test@example.com', role: 'ADMIN', firstName: 'John' };
    const sanitized = sanitizeLogData(data);
    expect(sanitized).toEqual(data);
  });

  it('should not mutate the original object', () => {
    const data = { password: 'secret', name: 'test' };
    const original = { ...data };
    sanitizeLogData(data);
    expect(data).toEqual(original);
  });

  it('should handle empty object', () => {
    const sanitized = sanitizeLogData({});
    expect(sanitized).toEqual({});
  });

  it('should handle object with no sensitive keys', () => {
    const data = { id: '1', status: 'active', count: 42 };
    const sanitized = sanitizeLogData(data);
    expect(sanitized).toEqual(data);
  });

  it('should handle mixed sensitive and non-sensitive keys', () => {
    const data = {
      userId: 'user-1',
      email: 'test@example.com',
      password: 'secret',
      role: 'ADMIN',
      authToken: 'token123',
      firstName: 'John',
    };
    const sanitized = sanitizeLogData(data);
    expect(sanitized.userId).toBe('user-1');
    expect(sanitized.email).toBe('test@example.com');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.role).toBe('ADMIN');
    expect(sanitized.authToken).toBe('[REDACTED]');
    expect(sanitized.firstName).toBe('John');
  });
});
