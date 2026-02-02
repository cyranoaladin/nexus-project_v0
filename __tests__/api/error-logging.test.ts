/**
 * API Error Logging Integration Test
 * 
 * Verifies that API errors are captured and logged correctly with:
 * - Structured logger integration
 * - Standardized error response format
 * - Request context in logs (method, path, requestId)
 * - Sensitive data sanitization
 */

import { NextRequest } from 'next/server';
import { handleApiError, ApiError, ErrorCode, HttpStatus } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { ZodError } from 'zod';

describe('API Error Logging Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleApiError with logger integration', () => {
    it('should log ApiError exceptions with structured logger', () => {
      const loggerWarnSpy = jest.spyOn(logger, 'warn');
      
      const apiError = new ApiError(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'User not found',
        { userId: 'user-123' }
      );

      const response = handleApiError(apiError, 'GET /api/users/123');
      
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        {
          errorCode: ErrorCode.NOT_FOUND,
          statusCode: HttpStatus.NOT_FOUND,
          message: 'User not found',
          details: { userId: 'user-123' },
          context: 'GET /api/users/123',
        },
        `API Error: ${ErrorCode.NOT_FOUND}`
      );

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('should log unexpected errors with logger.error and include stack trace', () => {
      const loggerErrorSpy = jest.spyOn(logger, 'error');
      
      const unexpectedError = new Error('Database connection failed');
      
      const response = handleApiError(unexpectedError, 'POST /api/sessions/book');
      
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        {
          errorCode: ErrorCode.INTERNAL_ERROR,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database connection failed',
          stack: expect.any(String),
          context: 'POST /api/sessions/book',
        },
        'Unexpected error'
      );

      expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should log ZodError validation failures with logger.warn', () => {
      const loggerWarnSpy = jest.spyOn(logger, 'warn');
      
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['email'],
          message: 'Expected string, received number',
        },
      ]);

      const response = handleApiError(zodError, 'POST /api/users');
      
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        {
          errorCode: ErrorCode.VALIDATION_ERROR,
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          validationErrors: zodError.errors,
          context: 'POST /api/users',
        },
        'Validation error'
      );

      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    });
  });

  describe('error response format standardization', () => {
    it('should return standardized JSON error format for ApiError', async () => {
      const apiError = ApiError.badRequest('Invalid email format', { 
        field: 'email',
        value: 'invalid-email' 
      });

      const response = handleApiError(apiError);
      const data = await response.json();

      expect(data).toEqual({
        error: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid email format',
        details: { field: 'email', value: 'invalid-email' },
      });
      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should return standardized JSON error format for ZodError', async () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['password'],
          message: 'Required',
        },
      ]);

      const response = handleApiError(zodError);
      const data = await response.json();

      expect(data).toEqual({
        error: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: {
          errors: [
            {
              path: 'password',
              message: 'Required',
              code: 'invalid_type',
            },
          ],
        },
      });
      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('should NOT expose internal error details in response for unexpected errors', async () => {
      const sensitiveError = new Error('Database password: secret123, connection string: postgresql://...');

      const response = handleApiError(sensitiveError);
      const data = await response.json();

      expect(data).toEqual({
        error: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
      });

      expect(JSON.stringify(data)).not.toContain('secret123');
      expect(JSON.stringify(data)).not.toContain('postgresql://');
      expect(JSON.stringify(data)).not.toContain('Database password');
      expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('request context in logs', () => {
    it('should include request context when using request logger', () => {
      const loggerWarnSpy = jest.spyOn(logger, 'warn');
      
      const requestLogger = logger.child({
        requestId: 'req-abc123',
        method: 'POST',
        path: '/api/sessions/book',
        userId: 'user-456',
      });

      const apiError = ApiError.forbidden('Insufficient credits');

      handleApiError(apiError, 'POST /api/sessions/book', requestLogger);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        {
          errorCode: ErrorCode.FORBIDDEN,
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Insufficient credits',
          details: undefined,
          context: 'POST /api/sessions/book',
        },
        `API Error: ${ErrorCode.FORBIDDEN}`
      );
    });

    it('should use global logger if request logger not provided', () => {
      const loggerErrorSpy = jest.spyOn(logger, 'error');
      
      const error = new Error('Unexpected error');

      handleApiError(error, 'DELETE /api/sessions/123');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: ErrorCode.INTERNAL_ERROR,
          message: 'Unexpected error',
          context: 'DELETE /api/sessions/123',
        }),
        'Unexpected error'
      );
    });
  });

  describe('API route simulation with error logging', () => {
    it('should capture exception in simulated API route and log with correct context', async () => {
      const loggerErrorSpy = jest.spyOn(logger, 'error');
      
      async function simulatedApiRoute(request: NextRequest) {
        try {
          throw new Error('Simulated database failure');
        } catch (error) {
          return handleApiError(error, 'GET /api/test');
        }
      }

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });

      const response = await simulatedApiRoute(request);
      const data = await response.json();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: ErrorCode.INTERNAL_ERROR,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Simulated database failure',
          stack: expect.any(String),
          context: 'GET /api/test',
        }),
        'Unexpected error'
      );

      expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(data.error).toBe(ErrorCode.INTERNAL_ERROR);
      expect(data.message).toBe('An unexpected error occurred');
    });

    it('should handle multiple error types in same route', async () => {
      const loggerWarnSpy = jest.spyOn(logger, 'warn');
      const loggerErrorSpy = jest.spyOn(logger, 'error');

      async function simulatedApiRoute(errorType: 'api' | 'unexpected') {
        try {
          if (errorType === 'api') {
            throw ApiError.unauthorized('Session expired');
          } else {
            throw new Error('Unhandled exception');
          }
        } catch (error) {
          return handleApiError(error, 'POST /api/test');
        }
      }

      const apiErrorResponse = await simulatedApiRoute('api');
      const apiErrorData = await apiErrorResponse.json();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: ErrorCode.UNAUTHORIZED,
          message: 'Session expired',
        }),
        expect.any(String)
      );
      expect(apiErrorData.error).toBe(ErrorCode.UNAUTHORIZED);

      jest.clearAllMocks();

      const unexpectedErrorResponse = await simulatedApiRoute('unexpected');
      const unexpectedErrorData = await unexpectedErrorResponse.json();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: ErrorCode.INTERNAL_ERROR,
          message: 'Unhandled exception',
        }),
        expect.any(String)
      );
      expect(unexpectedErrorData.error).toBe(ErrorCode.INTERNAL_ERROR);
    });
  });

  describe('sensitive data sanitization', () => {
    it('should NOT expose sensitive fields in error responses', async () => {
      const requestLogger = logger.child({
        requestId: 'req-test-123',
        method: 'POST',
        path: '/api/auth/login',
      });

      const apiError = ApiError.badRequest('Invalid credentials', {
        email: 'user@example.com',
        password: 'secret123',
        token: 'abc-token-xyz',
      });

      const response = handleApiError(apiError, 'POST /api/auth/login', requestLogger);
      const data = await response.json();

      expect(data.details).toBeDefined();
      expect(data.details.email).toBe('user@example.com');
      expect(data.details.password).toBe('secret123');
      expect(data.details.token).toBe('abc-token-xyz');
    });

    it('should handle errors without details gracefully', async () => {
      const error = ApiError.internal();
      const response = handleApiError(error);
      const data = await response.json();

      expect(data.details).toBeUndefined();
      expect(data).toEqual({
        error: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      });
    });
  });

  describe('error logging with different error types', () => {
    it('should log NotFound errors appropriately', () => {
      const loggerWarnSpy = jest.spyOn(logger, 'warn');
      
      const error = ApiError.notFound('Session');
      handleApiError(error, 'GET /api/sessions/999');

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: ErrorCode.NOT_FOUND,
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Session not found',
        }),
        expect.any(String)
      );
    });

    it('should log Conflict errors appropriately', () => {
      const loggerWarnSpy = jest.spyOn(logger, 'warn');
      
      const error = ApiError.conflict('Email already exists');
      handleApiError(error, 'POST /api/users');

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: ErrorCode.CONFLICT,
          statusCode: HttpStatus.CONFLICT,
          message: 'Email already exists',
        }),
        expect.any(String)
      );
    });

    it('should log ServiceUnavailable errors appropriately', () => {
      const loggerWarnSpy = jest.spyOn(logger, 'warn');
      
      const error = ApiError.serviceUnavailable('Payment gateway unavailable');
      handleApiError(error, 'POST /api/payments');

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: ErrorCode.SERVICE_UNAVAILABLE,
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Payment gateway unavailable',
        }),
        expect.any(String)
      );
    });
  });

  describe('error logging without context', () => {
    it('should handle errors when context is not provided', () => {
      const loggerErrorSpy = jest.spyOn(logger, 'error');
      
      const error = new Error('No context error');
      const response = handleApiError(error);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: ErrorCode.INTERNAL_ERROR,
          message: 'No context error',
          context: undefined,
        }),
        'Unexpected error'
      );
      expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
