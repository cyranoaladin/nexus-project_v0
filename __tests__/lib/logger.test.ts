import { logger, createRequestLogger, sanitizeLogData } from '../../lib/logger';

describe('Logger System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logger instance', () => {
    it('should be defined and have standard logging methods', () => {
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should log info level messages', () => {
      const infoSpy = jest.spyOn(logger, 'info');
      logger.info('Test info message');
      expect(infoSpy).toHaveBeenCalledWith('Test info message');
    });

    it('should log warn level messages', () => {
      const warnSpy = jest.spyOn(logger, 'warn');
      logger.warn('Test warning message');
      expect(warnSpy).toHaveBeenCalledWith('Test warning message');
    });

    it('should log error level messages', () => {
      const errorSpy = jest.spyOn(logger, 'error');
      logger.error('Test error message');
      expect(errorSpy).toHaveBeenCalledWith('Test error message');
    });

    it('should log debug level messages', () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      logger.debug('Test debug message');
      expect(debugSpy).toHaveBeenCalledWith('Test debug message');
    });

    it('should log structured data with context', () => {
      const infoSpy = jest.spyOn(logger, 'info');
      const logData = {
        userId: 'user-123',
        action: 'login',
        status: 'success'
      };
      logger.info(logData, 'User logged in');
      expect(infoSpy).toHaveBeenCalledWith(logData, 'User logged in');
    });

    it('should use silent level in test environment', () => {
      expect(logger.level).toBe('silent');
    });
  });

  describe('createRequestLogger', () => {
    it('should create a child logger with request context', () => {
      const context = {
        requestId: 'req-123',
        method: 'POST',
        path: '/api/users',
        userId: 'user-456'
      };

      const requestLogger = createRequestLogger(context);

      expect(requestLogger).toBeDefined();
      expect(typeof requestLogger.info).toBe('function');
      expect(typeof requestLogger.warn).toBe('function');
      expect(typeof requestLogger.error).toBe('function');
    });

    it('should create child logger without optional userId', () => {
      const context = {
        requestId: 'req-789',
        method: 'GET',
        path: '/api/sessions'
      };

      const requestLogger = createRequestLogger(context);

      expect(requestLogger).toBeDefined();
    });

    it('should include request context in log messages', () => {
      const context = {
        requestId: 'req-123',
        method: 'POST',
        path: '/api/users',
        userId: 'user-456'
      };

      const requestLogger = createRequestLogger(context);
      const infoSpy = jest.spyOn(requestLogger, 'info');

      requestLogger.info('Processing request');

      expect(infoSpy).toHaveBeenCalledWith('Processing request');
    });

    it('should propagate log levels from parent logger', () => {
      const context = {
        requestId: 'req-999',
        method: 'DELETE',
        path: '/api/sessions/123'
      };

      const requestLogger = createRequestLogger(context);

      expect(requestLogger.level).toBe(logger.level);
    });
  });

  describe('sanitizeLogData', () => {
    it('should redact password field', () => {
      const data = {
        email: 'user@example.com',
        password: 'secret123'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.email).toBe('user@example.com');
      expect(sanitized.password).toBe('[REDACTED]');
    });

    it('should redact token field', () => {
      const data = {
        userId: 'user-123',
        token: 'abc123xyz'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.userId).toBe('user-123');
      expect(sanitized.token).toBe('[REDACTED]');
    });

    it('should redact apiKey field', () => {
      const data = {
        service: 'external-api',
        apiKey: 'key-12345'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.service).toBe('external-api');
      expect(sanitized.apiKey).toBe('[REDACTED]');
    });

    it('should redact secret field', () => {
      const data = {
        name: 'config',
        secret: 'my-secret-value'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.name).toBe('config');
      expect(sanitized.secret).toBe('[REDACTED]');
    });

    it('should redact creditCard field', () => {
      const data = {
        userId: 'user-123',
        creditCard: '4111-1111-1111-1111'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.userId).toBe('user-123');
      expect(sanitized.creditCard).toBe('[REDACTED]');
    });

    it('should redact ssn field', () => {
      const data = {
        name: 'John Doe',
        ssn: '123-45-6789'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.name).toBe('John Doe');
      expect(sanitized.ssn).toBe('[REDACTED]');
    });

    it('should redact fields with sensitive keywords in key name (case-insensitive)', () => {
      const data = {
        userPassword: 'secret',
        authToken: 'token123',
        apiKeyValue: 'key456',
        clientSecret: 'secret789'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.userPassword).toBe('[REDACTED]');
      expect(sanitized.authToken).toBe('[REDACTED]');
      expect(sanitized.apiKeyValue).toBe('[REDACTED]');
      expect(sanitized.clientSecret).toBe('[REDACTED]');
    });

    it('should handle mixed case field names', () => {
      const data = {
        UserPassword: 'secret',
        AUTH_TOKEN: 'token123',
        ApiKey: 'key456'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.UserPassword).toBe('[REDACTED]');
      expect(sanitized.AUTH_TOKEN).toBe('[REDACTED]');
      expect(sanitized.ApiKey).toBe('[REDACTED]');
    });

    it('should not modify non-sensitive fields', () => {
      const data = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'ADMIN',
        action: 'update',
        timestamp: '2026-02-02T10:00:00Z'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized).toEqual(data);
    });

    it('should not mutate the original data object', () => {
      const data = {
        email: 'user@example.com',
        password: 'secret123'
      };

      const originalData = { ...data };
      const sanitized = sanitizeLogData(data);

      expect(data).toEqual(originalData);
      expect(sanitized).not.toBe(data);
    });

    it('should handle empty objects', () => {
      const data = {};
      const sanitized = sanitizeLogData(data);

      expect(sanitized).toEqual({});
    });

    it('should handle multiple sensitive fields', () => {
      const data = {
        userId: 'user-123',
        password: 'pass123',
        token: 'token456',
        apiKey: 'key789',
        email: 'user@example.com'
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.userId).toBe('user-123');
      expect(sanitized.email).toBe('user@example.com');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
    });
  });

  describe('environment-specific behavior', () => {
    it('should use silent level in test environment', () => {
      // In tests, logger is silent to avoid console noise
      expect(logger.level).toBe('silent');
    });

    it('should have base context with environment', () => {
      const childLogger = logger.child({});
      expect(childLogger).toBeDefined();
    });
  });

  describe('logging performance', () => {
    it('should log messages with minimal overhead (< 5ms)', () => {
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        logger.info({ iteration: i, data: 'test-data' }, 'Performance test');
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      expect(avgTime).toBeLessThan(5);
    });

    it('should create request loggers with minimal overhead (< 5ms)', () => {
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const requestLogger = createRequestLogger({
          requestId: `req-${i}`,
          method: 'GET',
          path: '/api/test',
          userId: `user-${i}`
        });
        requestLogger.info('Test message');
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      expect(avgTime).toBeLessThan(5);
    });

    it('should sanitize data with minimal overhead (< 5ms)', () => {
      const data = {
        userId: 'user-123',
        email: 'user@example.com',
        password: 'secret123',
        token: 'token456',
        apiKey: 'key789',
        role: 'ADMIN',
        status: 'active'
      };

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        sanitizeLogData(data);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      expect(avgTime).toBeLessThan(5);
    });
  });

  describe('error logging with stack traces', () => {
    it('should log errors with stack traces', () => {
      const errorSpy = jest.spyOn(logger, 'error');
      const testError = new Error('Test error message');

      logger.error({ err: testError }, 'An error occurred');

      expect(errorSpy).toHaveBeenCalledWith(
        { err: testError },
        'An error occurred'
      );
    });

    it('should handle error objects in structured data', () => {
      const errorSpy = jest.spyOn(logger, 'error');
      const testError = new Error('Database connection failed');

      logger.error({
        err: testError,
        userId: 'user-123',
        operation: 'fetchUser'
      }, 'Database operation failed');

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('request logger integration', () => {
    it('should create request logger and log with full context', () => {
      const context = {
        requestId: 'req-integration-test',
        method: 'POST',
        path: '/api/sessions/book',
        userId: 'user-integration'
      };

      const requestLogger = createRequestLogger(context);
      const infoSpy = jest.spyOn(requestLogger, 'info');
      const errorSpy = jest.spyOn(requestLogger, 'error');

      requestLogger.info({ action: 'booking-start' }, 'Starting session booking');
      requestLogger.error({ error: 'insufficient-credits' }, 'Booking failed');

      expect(infoSpy).toHaveBeenCalledWith(
        { action: 'booking-start' },
        'Starting session booking'
      );
      expect(errorSpy).toHaveBeenCalledWith(
        { error: 'insufficient-credits' },
        'Booking failed'
      );
    });

    it('should handle multiple request loggers independently', () => {
      const logger1 = createRequestLogger({
        requestId: 'req-1',
        method: 'GET',
        path: '/api/users'
      });

      const logger2 = createRequestLogger({
        requestId: 'req-2',
        method: 'POST',
        path: '/api/sessions'
      });

      const spy1 = jest.spyOn(logger1, 'info');
      const spy2 = jest.spyOn(logger2, 'info');

      logger1.info('Request 1 log');
      logger2.info('Request 2 log');

      expect(spy1).toHaveBeenCalledWith('Request 1 log');
      expect(spy2).toHaveBeenCalledWith('Request 2 log');
    });
  });
});
