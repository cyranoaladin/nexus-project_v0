/**
 * @jest-environment node
 */

/**
 * Tests for lib/api/errors.ts
 *
 * Covers: ApiError class, factory methods, errorResponse, handleZodError,
 * handleApiError, successResponse
 */

import { ZodError, ZodIssueCode } from 'zod';

// Mock logger before importing errors module
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  },
}));

import {
  ApiError,
  HttpStatus,
  ErrorCode,
  errorResponse,
  handleZodError,
  handleApiError,
  successResponse,
} from '@/lib/api/errors';

describe('HttpStatus', () => {
  it('has standard HTTP status codes', () => {
    expect(HttpStatus.OK).toBe(200);
    expect(HttpStatus.CREATED).toBe(201);
    expect(HttpStatus.NO_CONTENT).toBe(204);
    expect(HttpStatus.BAD_REQUEST).toBe(400);
    expect(HttpStatus.UNAUTHORIZED).toBe(401);
    expect(HttpStatus.FORBIDDEN).toBe(403);
    expect(HttpStatus.NOT_FOUND).toBe(404);
    expect(HttpStatus.CONFLICT).toBe(409);
    expect(HttpStatus.UNPROCESSABLE_ENTITY).toBe(422);
    expect(HttpStatus.TOO_MANY_REQUESTS).toBe(429);
    expect(HttpStatus.INTERNAL_SERVER_ERROR).toBe(500);
    expect(HttpStatus.SERVICE_UNAVAILABLE).toBe(503);
  });
});

describe('ErrorCode', () => {
  it('has standard error codes', () => {
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN');
    expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(ErrorCode.CONFLICT).toBe('CONFLICT');
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
    expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(ErrorCode.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('ApiError', () => {
  it('creates an error with all properties', () => {
    const err = new ApiError(400, ErrorCode.VALIDATION_ERROR, 'Bad input', { field: 'email' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Bad input');
    expect(err.details).toEqual({ field: 'email' });
    expect(err.name).toBe('ApiError');
    expect(err).toBeInstanceOf(Error);
  });

  describe('toResponse', () => {
    it('returns NextResponse with correct status and body', async () => {
      const err = new ApiError(404, ErrorCode.NOT_FOUND, 'User not found');
      const res = err.toResponse();
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('NOT_FOUND');
      expect(body.message).toBe('User not found');
      expect(body.details).toBeUndefined();
    });

    it('includes details when provided', async () => {
      const err = new ApiError(400, ErrorCode.VALIDATION_ERROR, 'Invalid', { fields: ['email'] });
      const res = err.toResponse();
      const body = await res.json();
      expect(body.details).toEqual({ fields: ['email'] });
    });
  });

  describe('static factory methods', () => {
    it('badRequest creates 400 error', () => {
      const err = ApiError.badRequest('Invalid email', { field: 'email' });
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.details).toEqual({ field: 'email' });
    });

    it('unauthorized creates 401 error with default message', () => {
      const err = ApiError.unauthorized();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.message).toBe('Authentication required');
    });

    it('unauthorized accepts custom message', () => {
      const err = ApiError.unauthorized('Token expired');
      expect(err.message).toBe('Token expired');
    });

    it('forbidden creates 403 error with default message', () => {
      const err = ApiError.forbidden();
      expect(err.statusCode).toBe(403);
      expect(err.message).toBe('Access denied');
    });

    it('notFound creates 404 error with resource name', () => {
      const err = ApiError.notFound('User');
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe('User not found');
    });

    it('notFound uses default resource name', () => {
      const err = ApiError.notFound();
      expect(err.message).toBe('Resource not found');
    });

    it('conflict creates 409 error', () => {
      const err = ApiError.conflict('Email already exists');
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('CONFLICT');
    });

    it('internal creates 500 error with default message', () => {
      const err = ApiError.internal();
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe('Internal server error');
    });

    it('serviceUnavailable creates 503 error', () => {
      const err = ApiError.serviceUnavailable();
      expect(err.statusCode).toBe(503);
      expect(err.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('serviceUnavailable accepts custom message', () => {
      const err = ApiError.serviceUnavailable('DB down');
      expect(err.message).toBe('DB down');
    });
  });
});

describe('errorResponse', () => {
  it('creates a JSON response with error format', async () => {
    const res = errorResponse(400, 'VALIDATION_ERROR', 'Bad input');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Bad input');
  });

  it('includes details when provided', async () => {
    const res = errorResponse(422, 'VALIDATION_ERROR', 'Invalid', { fields: ['name'] });
    const body = await res.json();
    expect(body.details).toEqual({ fields: ['name'] });
  });

  it('omits details when not provided', async () => {
    const res = errorResponse(500, 'INTERNAL_ERROR', 'Oops');
    const body = await res.json();
    expect(body.details).toBeUndefined();
  });
});

describe('handleZodError', () => {
  it('formats ZodError into API response', async () => {
    const zodError = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'number',
        path: ['email'],
        message: 'Expected string, received number',
      },
    ]);

    const res = handleZodError(zodError);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Validation failed');
    expect(body.details.errors).toHaveLength(1);
    expect(body.details.errors[0].path).toBe('email');
  });
});

describe('handleApiError', () => {
  it('handles ApiError', async () => {
    const err = ApiError.notFound('Session');
    const res = await handleApiError(err, 'GET /api/sessions');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  it('handles ZodError', async () => {
    const zodError = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'undefined',
        path: ['name'],
        message: 'Required',
      },
    ]);
    const res = await handleApiError(zodError, 'POST /api/users');
    expect(res.status).toBe(422);
  });

  it('handles generic Error with 500', async () => {
    const err = new Error('Something broke');
    const res = await handleApiError(err, 'GET /api/data');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('An unexpected error occurred');
  });

  it('handles non-Error objects with 500', async () => {
    const res = await handleApiError('string error', 'GET /api/data');
    expect(res.status).toBe(500);
  });

  it('accepts optional request logger', async () => {
    const mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const err = ApiError.badRequest('test');
    const res = await handleApiError(err, 'test', mockLogger as never);
    expect(res.status).toBe(400);
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});

describe('successResponse', () => {
  it('creates 200 response by default', async () => {
    const res = successResponse({ id: '1', name: 'Test' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: '1', name: 'Test' });
  });

  it('accepts custom status code', async () => {
    const res = successResponse({ created: true }, 201);
    expect(res.status).toBe(201);
  });
});
