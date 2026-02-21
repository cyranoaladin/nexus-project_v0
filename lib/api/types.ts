/**
 * Standard API Response Types
 *
 * Defines consistent response envelopes for all API endpoints.
 * Use these types and helper functions to ensure uniform responses.
 */

/**
 * Pagination metadata for list responses
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Optional metadata that can be included in responses
 */
export interface ResponseMeta {
  pagination?: PaginationMeta;
  timestamp?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Standard success response envelope
 *
 * All successful API responses should use this format for consistency.
 *
 * @example
 * ```ts
 * const response: ApiSuccessResponse<User[]> = {
 *   success: true,
 *   data: users,
 *   meta: {
 *     pagination: { total: 100, limit: 20, offset: 0, hasMore: true }
 *   }
 * };
 * ```
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

/**
 * Error details structure
 */
export interface ErrorDetails {
  code: string;
  message: string;
  field?: string;
  details?: unknown;
}

/**
 * Standard error response envelope
 *
 * All error API responses should use this format for consistency.
 *
 * @example
 * ```ts
 * const response: ApiErrorResponse = {
 *   success: false,
 *   error: {
 *     code: 'VALIDATION_ERROR',
 *     message: 'Invalid email format',
 *     field: 'email'
 *   }
 * };
 * ```
 */
export interface ApiErrorResponse {
  success: false;
  error: ErrorDetails;
  meta?: ResponseMeta;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
