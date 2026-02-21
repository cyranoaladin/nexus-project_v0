/**
 * User Validation Schemas
 *
 * Validation for user-related API endpoints (admin/users).
 */

import { z } from 'zod';
import { UserRole } from '@/types/enums';
import { emailSchema, idSchema, paginationSchema, phoneSchema, passwordSchema, optionalString } from './common';

/**
 * User creation schema (POST /api/admin/users)
 */
export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.nativeEnum(UserRole, { errorMap: () => ({ message: 'Invalid role' }) }),
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  phone: phoneSchema.optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * User update schema (PATCH /api/admin/users/:id)
 */
export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  role: z.nativeEnum(UserRole).optional(),
  firstName: optionalString,
  lastName: optionalString,
  phone: phoneSchema.optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * User list filters (GET /api/admin/users)
 */
export const listUsersSchema = z.object({
  role: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  ...paginationSchema.shape,
});

export type ListUsersParams = z.infer<typeof listUsersSchema>;

/**
 * User ID parameter validation
 */
export const userIdParamSchema = z.object({
  id: idSchema,
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;
