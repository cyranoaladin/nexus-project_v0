/**
 * User Validation Schemas
 *
 * Validation for user-related API endpoints (admin/users).
 */

import { z } from 'zod';
import { AcademicTrack, GradeLevel, StmgPathway, UserRole } from '@/types/enums';
import { validateChosenCourses } from '@/lib/curriculum/validation';
import { emailSchema, idSchema, paginationSchema, phoneSchema, passwordSchema, optionalString } from './common';

/**
 * Enseignements choisis d'un élève, exprimés en clés du catalogue versionné
 * (`data/curriculum/`).
 *
 * Remplace l'ancien champ `specialties: Subject[]`, qui acceptait des matières
 * de tronc commun (Français, Philosophie, Histoire-Géo, langues) comme des
 * « spécialités » et n'imposait aucun plafond. La validation est désormais
 * déléguée au catalogue : univers réel des spécialités, nombre maximal par
 * niveau, et dépendances entre enseignements.
 */
const studentTrackFields = {
  gradeLevel: z.nativeEnum(GradeLevel).optional(),
  academicTrack: z.nativeEnum(AcademicTrack).optional(),
  academicCourseKeys: z
    .array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/))
    .max(12)
    .optional(),
  stmgPathway: z.nativeEnum(StmgPathway).optional(),
};

function validateStudentTrackCombination(
  data: {
    role?: UserRole;
    gradeLevel?: GradeLevel;
    academicTrack?: AcademicTrack;
    academicCourseKeys?: string[];
    stmgPathway?: StmgPathway;
  },
  ctx: z.RefinementCtx
) {
  if (data.role && data.role !== UserRole.ELEVE) {
    return;
  }

  const courseKeys = data.academicCourseKeys ?? [];
  if (courseKeys.length === 0) return;

  for (const issue of validateChosenCourses(
    {
      gradeLevel: data.gradeLevel ?? null,
      academicTrack: data.academicTrack ?? null,
      stmgPathway: data.stmgPathway ?? null,
    },
    courseKeys,
  )) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['academicCourseKeys'],
      message: issue,
    });
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
  parentId: z.string().optional(), // Mandatory for ELEVE, checked in superRefine
  ...studentTrackFields,
}).superRefine((data, ctx) => {
  if (data.role === UserRole.ELEVE) {
    if (!data.gradeLevel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gradeLevel'],
        message: 'Le niveau scolaire est obligatoire pour un élève',
      });
    }
    if (!data.parentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parentId'],
        message: 'Le parent est obligatoire pour un élève',
      });
    }
  }
  validateStudentTrackCombination(data, ctx);
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
  parentId: z.string().optional(),
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
