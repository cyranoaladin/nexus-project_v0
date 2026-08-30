import { z } from 'zod';

const identifierSchema = z.string().trim().min(1).max(191);
const nullableNameSchema = z.string().trim().min(1).max(200).nullable();
const nullableEmailSchema = z.string().trim().email().max(320).nullable();
const nullableLabelSchema = z.string().trim().min(1).max(300).nullable();

export const candidatIndividuelStudentSearchRequestSchema = z
  .object({
    query: z.string().trim().max(100),
    page: z.number().int().min(1).max(10_000),
    limit: z.number().int().min(1).max(50),
  })
  .strict();

export const candidatIndividuelLeadSearchRequestSchema = z
  .object({
    query: z.string().trim().min(2).max(100),
    limit: z.number().int().min(1).max(50),
  })
  .strict();

export const candidatIndividuelStudentSearchItemSchema = z
  .object({
    studentId: identifierSchema,
    firstName: nullableNameSchema,
    lastName: nullableNameSchema,
    email: nullableEmailSchema,
    grade: nullableLabelSchema,
    school: nullableLabelSchema,
    selectable: z.boolean(),
    unavailableReason: z.string().trim().min(1).max(300).nullable(),
  })
  .strict();

export const candidatIndividuelLeadSearchItemSchema = z
  .object({
    contactLeadId: identifierSchema,
    name: z.string().trim().min(1).max(300),
    email: z.string().trim().email().max(320),
  })
  .strict();

export const candidatIndividuelStudentSearchSuccessSchema = z
  .object({
    success: z.literal(true),
    students: z.array(candidatIndividuelStudentSearchItemSchema),
    pagination: z
      .object({
        page: z.number().int().min(1).max(10_000),
        limit: z.number().int().min(1).max(50),
        total: z.number().int().nonnegative(),
        totalPages: z.number().int().min(0).max(10_000),
      })
      .strict(),
  })
  .strict();

export const candidatIndividuelLeadSearchSuccessSchema = z
  .object({
    success: z.literal(true),
    leads: z.array(candidatIndividuelLeadSearchItemSchema),
  })
  .strict();

export const candidatIndividuelSearchErrorCodeSchema = z.enum([
  'INVALID_REQUEST',
  'PIPELINE_INACTIVE',
  'RATE_LIMIT_EXCEEDED',
  'SEARCH_UNAVAILABLE',
]);

export const candidatIndividuelSearchErrorSchema = z
  .object({
    success: z.literal(false),
    error: z
      .object({
        code: candidatIndividuelSearchErrorCodeSchema,
      })
      .strict(),
  })
  .strict();

export const CANDIDAT_INDIVIDUEL_SEARCH_ERROR_STATUS = Object.freeze({
  INVALID_REQUEST: 400,
  PIPELINE_INACTIVE: 409,
  RATE_LIMIT_EXCEEDED: 429,
  SEARCH_UNAVAILABLE: 500,
} as const satisfies Record<CandidatIndividuelSearchErrorCode, number>);

export type CandidatIndividuelStudentSearchRequest = z.infer<typeof candidatIndividuelStudentSearchRequestSchema>;
export type CandidatIndividuelLeadSearchRequest = z.infer<typeof candidatIndividuelLeadSearchRequestSchema>;
export type CandidatIndividuelStudentSearchItem = z.infer<typeof candidatIndividuelStudentSearchItemSchema>;
export type CandidatIndividuelLeadSearchItem = z.infer<typeof candidatIndividuelLeadSearchItemSchema>;
export type CandidatIndividuelStudentSearchSuccess = z.infer<typeof candidatIndividuelStudentSearchSuccessSchema>;
export type CandidatIndividuelLeadSearchSuccess = z.infer<typeof candidatIndividuelLeadSearchSuccessSchema>;
export type CandidatIndividuelSearchErrorCode = z.infer<typeof candidatIndividuelSearchErrorCodeSchema>;
export type CandidatIndividuelSearchError = z.infer<typeof candidatIndividuelSearchErrorSchema>;
