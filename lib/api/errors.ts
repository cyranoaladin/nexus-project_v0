/**
 * API Error Handling - Uniform Error Responses
 *
 * Provides consistent error formatting across all API routes.
 * All API errors should use these utilities to ensure uniform client experience.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Standard HTTP Status Codes
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Standard Error Codes
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * API Error Response Format
 *
 * Consistent structure returned by all API errors:
 * - error: Machine-readable error code
 * - message: Human-readable error message
 * - details: Optional additional context (validation errors, etc.)
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

/**
 * Custom API Error Class
 *
 * Use this to throw typed errors in API routes that will be
 * automatically converted to proper HTTP responses.
 */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCodeType,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Convert to API response format
   */
  toResponse(): NextResponse<ApiErrorResponse> {
    return NextResponse.json(
      {
        error: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
      { status: this.statusCode }
    );
  }

  // Static factory methods for common errors
  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, message, details);
  }

  static unauthorized(message: string = 'Authentication required'): ApiError {
    return new ApiError(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED, message);
  }

  static forbidden(message: string = 'Access denied'): ApiError {
    return new ApiError(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, message);
  }

  static notFound(resource: string = 'Resource'): ApiError {
    return new ApiError(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, `${resource} not found`);
  }

  static conflict(message: string): ApiError {
    return new ApiError(HttpStatus.CONFLICT, ErrorCode.CONFLICT, message);
  }

  static internal(message: string = 'Internal server error'): ApiError {
    return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR, message);
  }

  static serviceUnavailable(message: string = 'Service temporarily unavailable'): ApiError {
    return new ApiError(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.SERVICE_UNAVAILABLE, message);
  }
}

/**
 * Create a standardized error response
 *
 * @param statusCode - HTTP status code
 * @param code - Error code (machine-readable)
 * @param message - Error message (human-readable)
 * @param details - Optional additional context
 *
 * @example
 * ```ts
 * return errorResponse(400, 'VALIDATION_ERROR', 'Invalid email format');
 * ```
 */
export function errorResponse(
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: code,
      message,
      ...(details && { details }),
    },
    { status: statusCode }
  );
}

/**
 * Handle Zod validation errors
 *
 * Converts ZodError into a user-friendly API error response.
 *
 * @param error - ZodError from schema.parse()
 *
 * @example
 * ```ts
 * try {
 *   const data = schema.parse(body);
 * } catch (error) {
 *   if (error instanceof ZodError) {
 *     return handleZodError(error);
 *   }
 * }
 * ```
 */
export function handleZodError(error: ZodError): NextResponse<ApiErrorResponse> {
  const formattedErrors = error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  return errorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    ErrorCode.VALIDATION_ERROR,
    'Validation failed',
    { errors: formattedErrors }
  );
}

/**
 * Safe error handler for API routes
 *
 * Catches all errors and returns appropriate responses:
 * - ApiError: Convert to response
 * - ZodError: Format validation errors
 * - Other: Generic 500 error (logs full error server-side)
 *
 * @param error - Any error thrown in API route
 * @param context - Optional context for logging (e.g., endpoint name)
 *
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   try {
 *     // ... route logic
 *   } catch (error) {
 *     return handleApiError(error, 'POST /api/users');
 *   }
 * }
 * ```
 */
export function handleApiError(error: unknown, context?: string): NextResponse<ApiErrorResponse> {
  // Log error server-side (sanitized)
  const logPrefix = context ? `[${context}]` : '[API Error]';

  if (error instanceof ApiError) {
    // ApiError is expected, log at warn level
    console.warn(`${logPrefix} ${error.code}:`, error.message);
    return error.toResponse();
  }

  if (error instanceof ZodError) {
    // Validation error, log at warn level
    console.warn(`${logPrefix} Validation error:`, error.errors);
    return handleZodError(error);
  }

  // Unexpected error, log at error level (but don't expose details to client)
  console.error(`${logPrefix} Unexpected error:`, error instanceof Error ? error.message : 'Unknown error');

  // SECURITY: Never expose internal error details to client
  return errorResponse(
    HttpStatus.INTERNAL_SERVER_ERROR,
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred'
  );
}

/**
 * Success response helper
 *
 * Creates a consistent success response format.
 *
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 *
 * @example
 * ```ts
 * return successResponse({ user: createdUser }, 201);
 * ```
 */
export function successResponse<T>(data: T, status: number = HttpStatus.OK): NextResponse<T> {
  return NextResponse.json(data, { status });
}
