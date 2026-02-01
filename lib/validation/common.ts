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
