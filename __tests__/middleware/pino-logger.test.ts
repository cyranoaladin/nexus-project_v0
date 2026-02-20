/**
 * Pino Logger Tests
 * Verifies Pino logger wrapper works correctly with structured logging
 */

import { NextRequest } from 'next/server';
import { createLogger, sanitizeLogData, logRequestBody, Logger, logger as pinoLogger } from '@/lib/middleware/logger';
import { AuthSession } from '@/lib/guards';
import { UserRole } from '@/types/enums';
import pino from 'pino';

// Mock pino to capture log outputs
jest.mock('pino', () => {
  const mockChild = jest.fn();
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: mockChild,
  };
  
  // Setup child to return a new mock logger instance with same structure
  mockChild.mockImplementation((context: any) => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: mockChild,
    _context: context, // Store context for test assertions
  }));
  
  const pinoMock = jest.fn(() => mockLogger);
  return pinoMock;
});

function createMockRequest(path: string = '/api/test', method: string = 'GET'): NextRequest {
  const url = `http://localhost:3000${path}`;
  const request = new NextRequest(url, {
    method,
    headers: {
      'x-forwarded-for': '192.168.1.100',
      'user-agent': 'test-agent',
    },
  });
  
  // Add nextUrl property that the logger expects
  (request as any).nextUrl = {
    pathname: path,
    href: url,
    origin: 'http://localhost:3000',
  };
  
  return request;
}

function createMockSession(userId: string = 'user-123', role: UserRole = UserRole.PARENT): AuthSession {
  return {
    user: {
      id: userId,
      role: role,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    },
    expires: '2099-01-01T00:00:00.000Z',
  };
}

describe('Pino Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Logger Initialization', () => {
    it('should create logger with request context', () => {
      const request = createMockRequest('/api/users', 'POST');
      const logger = createLogger(request);

      expect(logger).toBeInstanceOf(Logger);
      expect(logger.getRequestId()).toMatch(/^req_\d+_\w+$/);
    });

    it('should include user context when session provided', () => {
      const request = createMockRequest('/api/profile');
      const session = createMockSession('user-456', UserRole.ADMIN);
      const logger = createLogger(request, session);

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;

      expect(mockChild).toHaveBeenCalled();
      const contextArg = mockChild.mock.calls[0][0];
      
      expect(contextArg.userId).toBe('user-456');
      expect(contextArg.userRole).toBe(UserRole.ADMIN);
      expect(contextArg.method).toBe('GET');
      expect(contextArg.path).toBe('/api/profile');
    });

    it('should not include user context when no session provided', () => {
      const request = createMockRequest('/api/public');
      const logger = createLogger(request);

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;

      expect(mockChild).toHaveBeenCalled();
      const contextArg = mockChild.mock.calls[0][0];
      
      expect(contextArg.userId).toBeUndefined();
      expect(contextArg.userRole).toBeUndefined();
    });
  });

  describe('Log Format Validation', () => {
    it('should log info with structured format', () => {
      const request = createMockRequest('/api/test');
      const logger = createLogger(request);

      logger.info('Test message', { custom: 'data' });

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;
      const childInstance = mockChild.mock.results[0].value;

      expect(childInstance.info).toHaveBeenCalledWith(
        { custom: 'data' },
        'Test message'
      );
    });

    it('should log debug with metadata', () => {
      const request = createMockRequest('/api/test');
      const logger = createLogger(request);

      logger.debug('Debug message', { debug: true, count: 42 });

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;
      const childInstance = mockChild.mock.results[0].value;

      expect(childInstance.debug).toHaveBeenCalledWith(
        { debug: true, count: 42 },
        'Debug message'
      );
    });

    it('should log warning with context', () => {
      const request = createMockRequest('/api/test');
      const logger = createLogger(request);

      logger.warn('Warning message', { severity: 'medium' });

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;
      const childInstance = mockChild.mock.results[0].value;

      expect(childInstance.warn).toHaveBeenCalledWith(
        { severity: 'medium' },
        'Warning message'
      );
    });

    it('should log error with Error object and stack trace', () => {
      const request = createMockRequest('/api/test');
      const logger = createLogger(request);
      const error = new Error('Test error');

      logger.error('Error occurred', error, { additional: 'info' });

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;
      const childInstance = mockChild.mock.results[0].value;

      expect(childInstance.error).toHaveBeenCalled();
      const [errorContext, message] = childInstance.error.mock.calls[0];

      expect(message).toBe('Error occurred');
      expect(errorContext.error).toBe('Test error');
      expect(errorContext.stack).toBeDefined();
      expect(errorContext.additional).toBe('info');
    });
  });

  describe('Security Event Logging', () => {
    it('should log security event with all required fields', () => {
      const request = createMockRequest('/api/protected');
      const session = createMockSession();
      const logger = createLogger(request, session);

      logger.logSecurityEvent('unauthorized_access', 401, {
        ip: '192.168.1.100',
        reason: 'Invalid token',
      });

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;
      const childInstance = mockChild.mock.results[0].value;

      expect(childInstance.warn).toHaveBeenCalled();
      const [logContext, message] = childInstance.warn.mock.calls[0];

      expect(message).toBe('Security event: unauthorized_access');
      expect(logContext.event).toBe('unauthorized_access');
      expect(logContext.statusCode).toBe(401);
      expect(logContext.duration).toBeGreaterThanOrEqual(0);
      expect(logContext.ip).toBe('192.168.1.100');
      expect(logContext.reason).toBe('Invalid token');
    });

    it('should log rate limit security event with retry information', () => {
      const request = createMockRequest('/api/aria/chat');
      const logger = createLogger(request);

      logger.logSecurityEvent('rate_limit_exceeded', 429, {
        ip: '192.168.1.200',
        limit: 10,
        retryAfter: 60,
      });

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;
      const childInstance = mockChild.mock.results[0].value;

      expect(childInstance.warn).toHaveBeenCalled();
      const [logContext, message] = childInstance.warn.mock.calls[0];

      expect(message).toBe('Security event: rate_limit_exceeded');
      expect(logContext.statusCode).toBe(429);
      expect(logContext.limit).toBe(10);
      expect(logContext.retryAfter).toBe(60);
    });

    it('should log forbidden access security event', () => {
      const request = createMockRequest('/api/admin');
      const session = createMockSession('user-789', UserRole.PARENT);
      const logger = createLogger(request, session);

      logger.logSecurityEvent('forbidden_access', 403, {
        ip: '192.168.1.150',
        requiredRole: UserRole.ADMIN,
        userRole: UserRole.PARENT,
      });

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;
      const childInstance = mockChild.mock.results[0].value;

      expect(childInstance.warn).toHaveBeenCalled();
      const [logContext] = childInstance.warn.mock.calls[0];

      expect(logContext.event).toBe('forbidden_access');
      expect(logContext.statusCode).toBe(403);
      expect(logContext.requiredRole).toBe(UserRole.ADMIN);
      expect(logContext.userRole).toBe(UserRole.PARENT);
    });
  });

  describe('Request Context Tracking', () => {
    it('should track request ID across all logs', () => {
      const request = createMockRequest('/api/test');
      const logger = createLogger(request);
      const requestId = logger.getRequestId();

      logger.info('First log');
      logger.info('Second log');

      expect(requestId).toMatch(/^req_\d+_\w+$/);
      expect(logger.getRequestId()).toBe(requestId);
    });

    it('should track user context when authenticated', () => {
      const request = createMockRequest('/api/profile');
      const session = createMockSession('user-999', UserRole.COACH);
      const logger = createLogger(request, session);

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;
      const contextArg = mockChild.mock.calls[0][0];

      expect(contextArg.userId).toBe('user-999');
      expect(contextArg.userRole).toBe(UserRole.COACH);
    });

    it('should add custom context dynamically', () => {
      const request = createMockRequest('/api/test');
      const logger = createLogger(request);

      logger.addContext('operationId', 'op-123');
      logger.addContext('feature', 'payment');

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;

      expect(mockChild).toHaveBeenCalledTimes(3);
      
      const lastCallContext = mockChild.mock.calls[2][0];
      expect(lastCallContext.operationId).toBe('op-123');
      expect(lastCallContext.feature).toBe('payment');
    });

    it('should track request duration', () => {
      const request = createMockRequest('/api/test');
      const logger = createLogger(request);

      const duration1 = logger.getDuration();
      expect(duration1).toBeGreaterThanOrEqual(0);

      setTimeout(() => {
        const duration2 = logger.getDuration();
        expect(duration2).toBeGreaterThanOrEqual(duration1);
      }, 10);
    });
  });

  describe('Request Logging with Performance Metrics', () => {
    it('should log successful request (2xx) as info', () => {
      const request = createMockRequest('/api/users', 'GET');
      const logger = createLogger(request);

      logger.logRequest(200, { count: 5 });

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;
      const childInstance = mockChild.mock.results[0].value;

      expect(childInstance.info).toHaveBeenCalled();
      const [logContext, message] = childInstance.info.mock.calls[0];

      expect(logContext.statusCode).toBe(200);
      expect(logContext.duration).toBeGreaterThanOrEqual(0);
      expect(logContext.count).toBe(5);
      expect(message).toContain('GET /api/users 200');
    });

    it('should log client error (4xx) as warning', () => {
      const request = createMockRequest('/api/users/999', 'GET');
      const logger = createLogger(request);

      logger.logRequest(404);

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;
      const childInstance = mockChild.mock.results[0].value;

      expect(childInstance.warn).toHaveBeenCalled();
      const [logContext] = childInstance.warn.mock.calls[0];

      expect(logContext.statusCode).toBe(404);
      expect(logContext.duration).toBeGreaterThanOrEqual(0);
    });

    it('should log server error (5xx) as error', () => {
      const request = createMockRequest('/api/users', 'POST');
      const logger = createLogger(request);

      logger.logRequest(500);

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;
      const childInstance = mockChild.mock.results[0].value;

      expect(childInstance.error).toHaveBeenCalled();
      const [logContext] = childInstance.error.mock.calls[0];

      expect(logContext.statusCode).toBe(500);
      expect(logContext.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Sensitive Data Sanitization', () => {
    it('should sanitize password fields', () => {
      const data = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com',
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.username).toBe('john');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.email).toBe('john@example.com');
    });

    it('should sanitize token fields', () => {
      const data = {
        userId: '123',
        authToken: 'abc123',
        accessToken: 'xyz789',
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.userId).toBe('123');
      expect(sanitized.authToken).toBe('[REDACTED]');
      expect(sanitized.accessToken).toBe('[REDACTED]');
    });

    it('should sanitize secret and API key fields', () => {
      const data = {
        apiKey: 'key123',
        api_key: 'key456',
        clientSecret: 'secret',
        data: 'public',
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.api_key).toBe('[REDACTED]');
      expect(sanitized.clientSecret).toBe('[REDACTED]');
      expect(sanitized.data).toBe('public');
    });

    it('should sanitize authorization headers', () => {
      const data = {
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer token123',
        },
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.headers).toEqual({
        'content-type': 'application/json',
        'authorization': '[REDACTED]',
      });
    });

    it('should sanitize cookie fields', () => {
      const data = {
        cookie: 'session=abc123',
        userId: '456',
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.cookie).toBe('[REDACTED]');
      expect(sanitized.userId).toBe('456');
    });

    it('should sanitize nested objects recursively', () => {
      const data = {
        user: {
          id: '123',
          email: 'user@example.com',
          credentials: {
            password: 'secret',
            token: 'abc123',
          },
        },
        public: true,
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.public).toBe(true);
      expect((sanitized.user as any).id).toBe('123');
      expect((sanitized.user as any).email).toBe('user@example.com');
      expect((sanitized.user as any).credentials.password).toBe('[REDACTED]');
      expect((sanitized.user as any).credentials.token).toBe('[REDACTED]');
    });

    it('should be case-insensitive when matching sensitive keys', () => {
      const data = {
        PASSWORD: 'secret',
        Token: 'abc123',
        ApiKey: 'key',
      };

      const sanitized = sanitizeLogData(data);

      expect(sanitized.PASSWORD).toBe('[REDACTED]');
      expect(sanitized.Token).toBe('[REDACTED]');
      expect(sanitized.ApiKey).toBe('[REDACTED]');
    });
  });

  describe('Request Body Logging', () => {
    it('should log sanitized request body', () => {
      const request = createMockRequest('/api/auth/login', 'POST');
      const logger = createLogger(request);

      const body = {
        email: 'user@example.com',
        password: 'secret123',
      };

      logRequestBody(logger, body);

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;
      const childInstance = mockChild.mock.results[0].value;

      expect(childInstance.debug).toHaveBeenCalled();
      const [logContext, message] = childInstance.debug.mock.calls[0];

      expect(message).toBe('Request body');
      expect(logContext.body.email).toBe('user@example.com');
      expect(logContext.body.password).toBe('[REDACTED]');
    });

    it('should handle non-object bodies gracefully', () => {
      const request = createMockRequest('/api/test');
      const logger = createLogger(request);

      logRequestBody(logger, 'string body');
      logRequestBody(logger, 123);
      logRequestBody(logger, null);

      const pinoInstance = pino as jest.MockedFunction<typeof pino>;
      const mockLogger = pinoInstance();
      const mockChild = mockLogger.child as jest.MockedFunction<any>;
      const childInstance = mockChild.mock.results[0].value;

      expect(childInstance.debug).not.toHaveBeenCalled();
    });
  });

  describe('Default Logger Instance', () => {
    it('should export default logger for non-request contexts', () => {
      expect(pinoLogger).toBeDefined();
    });
  });
});
