/**
 * @jest-environment node
 */

import { sanitizeLogData, LogPresets, timeOperation, Logger, createLogger, logRequestBody, LogLevel } from '@/lib/middleware/logger';
import { NextRequest } from 'next/server';

/** Create a mock NextRequest */
function mockRequest(method = 'GET', path = '/api/test'): NextRequest {
  return new NextRequest(new URL(path, 'http://localhost:3000'), { method });
}

describe('LogLevel enum', () => {
  it('has expected values', () => {
    expect(LogLevel.DEBUG).toBe('debug');
    expect(LogLevel.INFO).toBe('info');
    expect(LogLevel.WARN).toBe('warn');
    expect(LogLevel.ERROR).toBe('error');
  });
});

describe('sanitizeLogData', () => {
  it('sanitizes sensitive keys deeply', () => {
    const data = {
      password: 'secret',
      token: 'abc',
      nested: { api_key: 'key', ok: true },
    };
    const result = sanitizeLogData(data);
    expect(result.password).toBe('[REDACTED]');
    expect((result.nested as Record<string, unknown>).api_key).toBe('[REDACTED]');
  });

  it('redacts authorization header', () => {
    const result = sanitizeLogData({ Authorization: 'Bearer xyz' });
    expect(result.Authorization).toBe('[REDACTED]');
  });

  it('redacts cookie values', () => {
    const result = sanitizeLogData({ cookie: 'session=abc' });
    expect(result.cookie).toBe('[REDACTED]');
  });

  it('redacts secret keys', () => {
    const result = sanitizeLogData({ NEXTAUTH_SECRET: 'mysecret' });
    expect(result.NEXTAUTH_SECRET).toBe('[REDACTED]');
  });

  it('preserves non-sensitive keys', () => {
    const result = sanitizeLogData({ email: 'user@test.com', name: 'Test' });
    expect(result.email).toBe('user@test.com');
    expect(result.name).toBe('Test');
  });

  it('handles null nested values', () => {
    const result = sanitizeLogData({ data: null, name: 'ok' });
    expect(result.data).toBeNull();
    expect(result.name).toBe('ok');
  });
});

describe('Logger class', () => {
  it('creates logger from request without session', () => {
    const req = mockRequest('POST', '/api/users');
    const logger = new Logger(req);
    expect(logger.getRequestId()).toMatch(/^req_/);
    expect(logger.getDuration()).toBeGreaterThanOrEqual(0);
  });

  it('creates logger from request with session', () => {
    const req = mockRequest('GET', '/api/profile');
    const session = { user: { id: 'u1', role: 'ADMIN' } } as any;
    const logger = new Logger(req, session);
    expect(logger.getRequestId()).toMatch(/^req_/);
  });

  it('addContext updates logger context', () => {
    const req = mockRequest();
    const logger = new Logger(req);
    logger.addContext('customKey', 'customValue');
    // No throw means success
    expect(logger.getRequestId()).toBeTruthy();
  });

  it('debug logs without error', () => {
    const req = mockRequest();
    const logger = new Logger(req);
    expect(() => logger.debug('test debug')).not.toThrow();
    expect(() => logger.debug('test debug', { extra: 1 })).not.toThrow();
  });

  it('info logs without error', () => {
    const req = mockRequest();
    const logger = new Logger(req);
    expect(() => logger.info('test info')).not.toThrow();
    expect(() => logger.info('test info', { count: 5 })).not.toThrow();
  });

  it('warn logs without error', () => {
    const req = mockRequest();
    const logger = new Logger(req);
    expect(() => logger.warn('test warn')).not.toThrow();
    expect(() => logger.warn('test warn', { reason: 'slow' })).not.toThrow();
  });

  it('error logs with Error object', () => {
    const req = mockRequest();
    const logger = new Logger(req);
    expect(() => logger.error('test error', new Error('boom'))).not.toThrow();
  });

  it('error logs with non-Error object', () => {
    const req = mockRequest();
    const logger = new Logger(req);
    expect(() => logger.error('test error', 'string error')).not.toThrow();
  });

  it('error logs with meta', () => {
    const req = mockRequest();
    const logger = new Logger(req);
    expect(() => logger.error('test error', new Error('x'), { route: '/api' })).not.toThrow();
  });

  it('logRequest logs info for 2xx', () => {
    const req = mockRequest();
    const logger = new Logger(req);
    expect(() => logger.logRequest(200)).not.toThrow();
    expect(() => logger.logRequest(201, { created: true })).not.toThrow();
  });

  it('logRequest logs warn for 4xx', () => {
    const req = mockRequest();
    const logger = new Logger(req);
    expect(() => logger.logRequest(400)).not.toThrow();
    expect(() => logger.logRequest(404)).not.toThrow();
  });

  it('logRequest logs error for 5xx', () => {
    const req = mockRequest();
    const logger = new Logger(req);
    expect(() => logger.logRequest(500)).not.toThrow();
    expect(() => logger.logRequest(503)).not.toThrow();
  });

  it('logSecurityEvent logs warn', () => {
    const req = mockRequest();
    const logger = new Logger(req);
    expect(() => logger.logSecurityEvent('unauthorized_access', 401)).not.toThrow();
    expect(() => logger.logSecurityEvent('rate_limit_exceeded', 429, { ip: '1.2.3.4' })).not.toThrow();
  });
});

describe('createLogger', () => {
  it('returns Logger instance', () => {
    const req = mockRequest();
    const logger = createLogger(req);
    expect(logger).toBeInstanceOf(Logger);
  });

  it('accepts optional session', () => {
    const req = mockRequest();
    const session = { user: { id: 'u1', role: 'ELEVE' } } as any;
    const logger = createLogger(req, session);
    expect(logger).toBeInstanceOf(Logger);
  });
});

describe('logRequestBody', () => {
  it('logs sanitized body for objects', () => {
    const logger = {
      debug: jest.fn(),
    } as unknown as Logger;
    logRequestBody(logger, { email: 'test@test.com', password: 'secret' });
    expect(logger.debug).toHaveBeenCalledWith('Request body', expect.any(Object));
  });

  it('does not log non-object bodies', () => {
    const logger = {
      debug: jest.fn(),
    } as unknown as Logger;
    logRequestBody(logger, 'string body');
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('does not log null bodies', () => {
    const logger = {
      debug: jest.fn(),
    } as unknown as Logger;
    logRequestBody(logger, null);
    expect(logger.debug).not.toHaveBeenCalled();
  });
});

describe('timeOperation', () => {
  it('logs debug on success', async () => {
    const logger = {
      debug: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;

    const result = await timeOperation('op', async () => 42, logger);
    expect(result).toBe(42);
    expect(logger.debug).toHaveBeenCalled();
  });

  it('logs error on failure', async () => {
    const logger = {
      debug: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;

    await expect(timeOperation('op', async () => { throw new Error('fail'); }, logger))
      .rejects.toThrow('fail');
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('LogPresets', () => {
  it('authAttempt logs info', () => {
    const logger = { info: jest.fn(), debug: jest.fn() } as unknown as Logger;
    LogPresets.authAttempt(logger, 'user@test.com', true);
    expect(logger.info).toHaveBeenCalledWith('Authentication attempt', expect.objectContaining({ email: 'user@test.com', success: true }));
  });

  it('authzCheck logs debug', () => {
    const logger = { info: jest.fn(), debug: jest.fn() } as unknown as Logger;
    LogPresets.authzCheck(logger, 'resource', false);
    expect(logger.debug).toHaveBeenCalledWith('Authorization check', expect.objectContaining({ resource: 'resource', allowed: false }));
  });

  it('dbQuery logs debug', () => {
    const logger = { info: jest.fn(), debug: jest.fn() } as unknown as Logger;
    LogPresets.dbQuery(logger, 'findMany', 'User', 10);
    expect(logger.debug).toHaveBeenCalledWith('Database query', expect.objectContaining({ operation: 'findMany', table: 'User' }));
  });

  it('externalApi logs info', () => {
    const logger = { info: jest.fn(), debug: jest.fn() } as unknown as Logger;
    LogPresets.externalApi(logger, 'ollama', '/generate', 200, 150);
    expect(logger.info).toHaveBeenCalledWith('External API call', expect.objectContaining({ service: 'ollama', statusCode: 200 }));
  });
});
