/**
 * Common Validation Schemas
 *
 * Reusable Zod schemas for common patterns across API endpoints.
 */

import { z } from 'zod';

/**
 * Common ID validation (CUID format from Prisma)
 */
export const idSchema = z.string().cuid('Invalid ID format');

/**
 * Email validation
 */
export const emailSchema = z.string().email('Invalid email format').toLowerCase();

/**
 * Pagination schema (query parameters)
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * Date range schema
 */
export const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'End date must be after start date' }
);

/**
 * Search query schema
 */
export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  ...paginationSchema.shape,
});

/**
 * Currency amounts (in minor units - e.g., cents for USD, millimes for TND)
 */
export const amountSchema = z.number().int().positive('Amount must be positive');

/**
 * Phone number validation (international format)
 */
export const phoneSchema = z.string().regex(
  /^\+?[1-9]\d{1,14}$/,
  'Invalid phone number format'
);

/**
 * Password validation (min 8 chars, at least one letter and one number)
 */
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Optional string that trims whitespace and treats empty as undefined
 */
export const optionalString = z.string().trim().optional().or(z.literal('').transform(() => undefined));

/**
 * Required non-empty string
 */
export const nonEmptyString = z.string().trim().min(1, 'This field is required');

/**
 * Strict date string validator:
 * - YYYY-MM-DD: round-trip check (parsed year/month/day must match input components)
 *   to reject rolled-over dates like 2024-02-31, 2023-02-29
 * - Datetime: must include timezone offset or Z (rejects timezone-less like 2024-01-01T12:00:00),
 *   and applies the same round-trip check on the date portion to reject rolled-over datetimes
 *   like 2024-02-31T10:30:00Z
 */
export function isStrictDateString(v: string): boolean {
  const dateOnlyMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, yearStr, monthStr, dayStr] = dateOnlyMatch;
    return isValidDateComponents(Number(yearStr), Number(monthStr), Number(dayStr));
  }
  const datetimeMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})T.+$/);
  if (datetimeMatch) {
    // Datetime must have timezone offset (Z or ±HH:MM)
    if (!/[Zz]$|[+-]\d{2}:\d{2}$/.test(v)) return false;
    if (isNaN(Date.parse(v))) return false;
    // Round-trip check on date portion to reject rolled-over datetimes
    const [, yearStr, monthStr, dayStr] = datetimeMatch;
    return isValidDateComponents(Number(yearStr), Number(monthStr), Number(dayStr));
  }
  return false;
}

function isValidDateComponents(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

export const strictDateSchema = z.string().refine(isStrictDateString, {
  message: 'Date invalide (YYYY-MM-DD strict ou ISO datetime avec timezone)',
});
