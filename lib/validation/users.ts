/**
 * User Validation Schemas
 *
 * Validation for user-related API endpoints (admin/users).
 */

import { z } from 'zod';
import { AcademicTrack, GradeLevel, StmgPathway, Subject, UserRole } from '@/types/enums';
import { emailSchema, idSchema, paginationSchema, phoneSchema, passwordSchema, optionalString } from './common';

const EDS_SPECIALTIES = new Set<Subject>([
  Subject.MATHEMATIQUES,
  Subject.NSI,
  Subject.FRANCAIS,
  Subject.PHILOSOPHIE,
  Subject.HISTOIRE_GEO,
  Subject.ANGLAIS,
  Subject.ESPAGNOL,
  Subject.PHYSIQUE_CHIMIE,
  Subject.SVT,
  Subject.SES,
]);

const STMG_TRACKS = new Set<AcademicTrack>([
  AcademicTrack.STMG,
  AcademicTrack.STMG_NON_LYCEEN,
]);

const studentTrackFields = {
  gradeLevel: z.nativeEnum(GradeLevel).optional(),
  academicTrack: z.nativeEnum(AcademicTrack).optional(),
  specialties: z.array(z.nativeEnum(Subject)).optional(),
  stmgPathway: z.nativeEnum(StmgPathway).optional(),
};

function validateStudentTrackCombination(
  data: {
    role?: UserRole;
    academicTrack?: AcademicTrack;
    specialties?: Subject[];
    stmgPathway?: StmgPathway;
  },
  ctx: z.RefinementCtx
) {
  if (data.role && data.role !== UserRole.ELEVE) {
    return;
  }

  const academicTrack = data.academicTrack;
  const specialties = data.specialties ?? [];

  if (academicTrack && STMG_TRACKS.has(academicTrack)) {
    if (specialties.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['specialties'],
        message: 'Les spécialités EDS ne sont pas compatibles avec un parcours STMG',
      });
    }
    return;
  }

  for (const specialty of specialties) {
    if (!EDS_SPECIALTIES.has(specialty)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['specialties'],
        message: `Spécialité invalide: ${specialty}`,
      });
    }
  }
}

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
  ...studentTrackFields,
}).superRefine(validateStudentTrackCombination);

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
  ...studentTrackFields,
}).superRefine(validateStudentTrackCombination);

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
