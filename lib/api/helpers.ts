/**
 * API Route Helpers
 *
 * Utility functions for common API route operations.
 */

import { NextRequest } from 'next/server';
import { ApiError } from './errors';
import { ZodSchema } from 'zod';
import { createRequestLogger } from '@/lib/logger';
import type { Logger } from 'pino';

/**
 * Safe JSON parsing from request body
 *
 * Handles errors gracefully and returns typed result.
 *
 * @param request - Next.js request object
 * @returns Parsed JSON or throws ApiError
 *
 * @example
 * ```ts
 * const body = await safeJsonParse(request);
 * ```
 */
export async function safeJsonParse<T = unknown>(request: NextRequest): Promise<T> {
  try {
    const body = await request.json();
    return body as T;
  } catch {
    throw ApiError.badRequest('Invalid JSON in request body');
  }
}

/**
 * Parse and validate request body with Zod schema
 *
 * Combines JSON parsing and validation in one step.
 *
 * @param request - Next.js request object
 * @param schema - Zod schema for validation
 * @returns Validated data or throws ApiError/ZodError
 *
 * @example
 * ```ts
 * const data = await parseBody(request, createUserSchema);
 * ```
 */
export async function parseBody<T>(request: NextRequest, schema: ZodSchema<T>): Promise<T> {
  const body = await safeJsonParse(request);
  return schema.parse(body);
}

/**
 * Parse and validate URL search params with Zod schema
 *
 * Extracts query parameters and validates them against a schema.
 *
 * @param request - Next.js request object
 * @param schema - Zod schema for validation
 * @returns Validated params or throws ZodError
 *
 * @example
 * ```ts
 * const params = parseSearchParams(request, listUsersSchema);
 * ```
 */
export function parseSearchParams<T>(request: NextRequest, schema: ZodSchema<T>): T {
  const searchParams = request.nextUrl.searchParams;
  const params = Object.fromEntries(searchParams.entries());
  return schema.parse(params);
}

/**
 * Pagination helper - calculate skip/take from limit/offset
 *
 * Converts REST-style pagination (limit/offset) to Prisma-style (skip/take).
 *
 * @param limit - Maximum number of items to return
 * @param offset - Number of items to skip
 * @returns Object with skip and take for Prisma queries
 *
 * @example
 * ```ts
 * const { skip, take } = getPagination(20, 40);
 * const users = await prisma.user.findMany({ skip, take });
 * ```
 */
export function getPagination(limit: number, offset: number) {
  return {
    skip: offset,
    take: limit,
  };
}

/**
 * Create paginated response metadata
 *
 * Generates pagination metadata for list responses.
 *
 * @param total - Total number of items
 * @param limit - Items per page
 * @param offset - Current offset
 * @returns Pagination metadata object
 *
 * @example
 * ```ts
 * const users = await prisma.user.findMany({ skip, take });
 * const total = await prisma.user.count();
 * const pagination = createPaginationMeta(total, limit, offset);
 * return successResponse({ users, pagination });
 * ```
 */
export function createPaginationMeta(total: number, limit: number, offset: number) {
  return {
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
    page: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Extract ID from route params
 *
 * Safely extracts and validates ID from dynamic route segments.
 *
 * @param params - Route params object
 * @param paramName - Name of the param (default: 'id')
 * @returns ID string or throws ApiError
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
 *   const userId = getIdParam(params);
 *   // ...
 * }
 * ```
 */
export function getIdParam(params: Record<string, string | string[]>, paramName: string = 'id'): string {
  const id = params[paramName];

  if (typeof id !== 'string' || !id) {
    throw ApiError.badRequest(`Missing or invalid ${paramName} parameter`);
  }

  return id;
}

/**
 * Check if resource exists or throw 404
 *
 * Generic helper for existence checks.
 *
 * @param resource - Resource to check (null/undefined = not found)
 * @param resourceName - Name for error message
 * @returns Resource if exists, throws ApiError otherwise
 *
 * @example
 * ```ts
 * const user = await prisma.user.findUnique({ where: { id } });
 * assertExists(user, 'User');
 * ```
 */
export function assertExists<T>(resource: T | null | undefined, resourceName: string = 'Resource'): asserts resource is T {
  if (!resource) {
    throw ApiError.notFound(resourceName);
  }
}

/**
 * Check ownership or throw 403
 *
 * Validates that session user owns the resource.
 *
 * @param sessionUserId - ID of the authenticated user
 * @param resourceUserId - ID of the resource owner
 * @param message - Custom error message
 *
 * @example
 * ```ts
 * const student = await prisma.student.findUnique({ where: { id } });
 * assertOwnership(session.user.id, student.parentId, 'You do not own this student record');
 * ```
 */
export function assertOwnership(
  sessionUserId: string,
  resourceUserId: string,
  message: string = 'You do not have permission to access this resource'
): void {
  if (sessionUserId !== resourceUserId) {
    throw ApiError.forbidden(message);
  }
}

/**
 * Generate unique request ID for tracing
 *
 * Creates a UUID v4 for request correlation across logs.
 *
 * @returns UUID string
 *
 * @example
 * ```ts
 * const requestId = generateRequestId();
 * ```
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Log incoming API request and create request-scoped logger
 *
 * Creates a child logger with request context for tracing.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - Request path
 * @param requestId - Unique request identifier
 * @param userId - Optional authenticated user ID
 * @returns Pino logger instance with request context
 *
 * @example
 * ```ts
 * const requestId = generateRequestId();
 * const reqLogger = logRequest('POST', '/api/users', requestId, session?.user?.id);
 * reqLogger.info('Processing user creation');
 * ```
 */
export function logRequest(
  method: string,
  path: string,
  requestId: string,
  userId?: string
): Logger {
  const reqLogger = createRequestLogger({ requestId, method, path, userId });
  reqLogger.info({ event: 'request' }, 'Incoming request');
  return reqLogger;
}
