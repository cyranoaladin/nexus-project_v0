/**
 * Pagination helpers for API routes
 * Centralizes pagination logic with safe defaults
 */

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Parse and validate pagination parameters from URL search params
 * @param searchParams - URLSearchParams from request
 * @returns Validated pagination params with safe defaults
 */
export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const pageParam = Number.parseInt(searchParams.get('page') || '1', 10);
  const limitParam = Number.parseInt(searchParams.get('limit') || '20', 10);

  // Validate and clamp values
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, 100)  // Max 100 items per page
    : 20;  // Default 20

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

/**
 * Parse an enum parameter with validation
 * Returns the valid enum value or null if invalid
 */
export function parseEnumParam<T extends Record<string, string>>(
  value: string | null,
  enumObject: T
): T[keyof T] | null {
  if (!value) return null;

  const enumValues = Object.values(enumObject);
  if (enumValues.includes(value as T[keyof T])) {
    return value as T[keyof T];
  }

  return null;
}

/**
 * Create pagination response metadata
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
