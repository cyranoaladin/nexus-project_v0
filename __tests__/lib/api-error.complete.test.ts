/**
 * API Error — Complete Test Suite
 *
 * Tests: ErrorCodes, createErrorResponse, createSuccessResponse,
 *        handleApiError, validateRequiredFields
 *
 * Source: lib/api-error.ts
 */

import {
  ErrorCodes,
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateRequiredFields,
} from '@/lib/api-error';

// ─── ErrorCodes ──────────────────────────────────────────────────────────────

describe('ErrorCodes', () => {
  it('should have authentication error codes', () => {
    expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ErrorCodes.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
    expect(ErrorCodes.SESSION_EXPIRED).toBe('SESSION_EXPIRED');
  });

  it('should have authorization error codes', () => {
    expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');
    expect(ErrorCodes.INSUFFICIENT_PERMISSIONS).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('should have validation error codes', () => {
    expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCodes.INVALID_INPUT).toBe('INVALID_INPUT');
    expect(ErrorCodes.MISSING_REQUIRED_FIELD).toBe('MISSING_REQUIRED_FIELD');
  });

  it('should have resource error codes', () => {
    expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
    expect(ErrorCodes.RESOURCE_NOT_FOUND).toBe('RESOURCE_NOT_FOUND');
  });

  it('should have rate limit error code', () => {
    expect(ErrorCodes.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should have server error codes', () => {
    expect(ErrorCodes.INTERNAL_SERVER_ERROR).toBe('INTERNAL_SERVER_ERROR');
    expect(ErrorCodes.DATABASE_ERROR).toBe('DATABASE_ERROR');
    expect(ErrorCodes.EXTERNAL_SERVICE_ERROR).toBe('EXTERNAL_SERVICE_ERROR');
  });
});

// ─── createErrorResponse ─────────────────────────────────────────────────────

describe('createErrorResponse', () => {
  it('should return response with correct status code', () => {
    const response = createErrorResponse('TEST_ERROR', 'Test message', 400);
    expect(response.status).toBe(400);
  });

  it('should default to 500 status code', () => {
    const response = createErrorResponse('TEST_ERROR', 'Test message');
    expect(response.status).toBe(500);
  });

  it('should include error code and message in body', async () => {
    const response = createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Invalid input');
  });

  it('should include timestamp in ISO format', async () => {
    const response = createErrorResponse('TEST', 'msg', 400);
    const body = await response.json();
    expect(body.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should include details when provided', async () => {
    const response = createErrorResponse('TEST', 'msg', 400, { field: 'email' });
    const body = await response.json();
    expect(body.error.details).toEqual({ field: 'email' });
  });

  it('should not include details when not provided', async () => {
    const response = createErrorResponse('TEST', 'msg', 400);
    const body = await response.json();
    expect(body.error.details).toBeUndefined();
  });
});

// ─── createSuccessResponse ───────────────────────────────────────────────────

describe('createSuccessResponse', () => {
  it('should return response with 200 status by default', () => {
    const response = createSuccessResponse({ id: '1' });
    expect(response.status).toBe(200);
  });

  it('should return response with custom status code', () => {
    const response = createSuccessResponse({ id: '1' }, 201);
    expect(response.status).toBe(201);
  });

  it('should include data in body', async () => {
    const response = createSuccessResponse({ name: 'Test', count: 42 });
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ name: 'Test', count: 42 });
  });

  it('should include timestamp', async () => {
    const response = createSuccessResponse({});
    const body = await response.json();
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should handle array data', async () => {
    const response = createSuccessResponse([1, 2, 3]);
    const body = await response.json();
    expect(body.data).toEqual([1, 2, 3]);
  });

  it('should handle null data', async () => {
    const response = createSuccessResponse(null);
    const body = await response.json();
    expect(body.data).toBeNull();
  });
});

// ─── handleApiError ──────────────────────────────────────────────────────────

describe('handleApiError', () => {
  it('should handle Prisma P2002 unique constraint error', async () => {
    const error = { code: 'P2002', meta: { target: ['email'] } };
    const response = handleApiError(error);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should handle Prisma P2025 not found error', async () => {
    const error = { code: 'P2025' };
    const response = handleApiError(error);
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('should handle standard Error', async () => {
    const error = new Error('Something went wrong');
    const response = handleApiError(error);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should handle unknown error types', async () => {
    const response = handleApiError('string error');
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should handle null error', async () => {
    const response = handleApiError(null);
    expect(response.status).toBe(500);
  });

  it('should accept optional context parameter', async () => {
    const response = handleApiError(new Error('test'), 'user-creation');
    expect(response.status).toBe(500);
  });
});

// ─── validateRequiredFields ──────────────────────────────────────────────────

describe('validateRequiredFields', () => {
  it('should return valid when all fields present', () => {
    const result = validateRequiredFields(
      { name: 'John', email: 'john@example.com' },
      ['name', 'email']
    );
    expect(result.valid).toBe(true);
    expect(result.missing).toBeUndefined();
  });

  it('should return invalid with missing fields', () => {
    const result = validateRequiredFields(
      { name: 'John' },
      ['name', 'email', 'phone']
    );
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['email', 'phone']);
  });

  it('should handle empty body', () => {
    const result = validateRequiredFields({}, ['name', 'email']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['name', 'email']);
  });

  it('should handle empty required fields', () => {
    const result = validateRequiredFields({ name: 'John' }, []);
    expect(result.valid).toBe(true);
  });

  it('should treat falsy values as missing', () => {
    const result = validateRequiredFields(
      { name: '', count: 0, active: false },
      ['name', 'count', 'active']
    );
    expect(result.valid).toBe(false);
    // empty string, 0, and false are all falsy
    expect(result.missing).toContain('name');
    expect(result.missing).toContain('count');
    expect(result.missing).toContain('active');
  });

  it('should accept truthy values', () => {
    const result = validateRequiredFields(
      { name: 'John', count: 1, active: true },
      ['name', 'count', 'active']
    );
    expect(result.valid).toBe(true);
  });
});
