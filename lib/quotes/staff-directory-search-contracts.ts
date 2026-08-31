import { z } from 'zod';

import { isValidCandidateStudentId } from '@/lib/quotes/candidat-individuel-navigation';

const safeOpaqueIdSchema = z.string().refine(isValidCandidateStudentId, 'Invalid opaque identifier');

export const STAFF_LEAD_SEARCH_DEFAULT_LIMIT = 10;
export const STAFF_LEAD_SEARCH_MAX_LIMIT = 10;

export const staffLeadSearchRequestSchema = z
  .object({
    query: z.string().trim().min(2).max(100),
    limit: z.number().int().min(1).max(STAFF_LEAD_SEARCH_MAX_LIMIT).default(STAFF_LEAD_SEARCH_DEFAULT_LIMIT),
  })
  .strict();

export const planningStudentSearchRequestSchema = z
  .object({
    query: z.string().trim().min(2).max(100),
    page: z.number().int().min(1).max(10_000),
    limit: z.number().int().min(1).max(50),
  })
  .strict();

export const devisLeadSearchSuccessSchema = z
  .object({
    items: z.array(z.object({
      id: safeOpaqueIdSchema,
      name: z.string().trim().min(1).max(300),
      email: z.string().trim().email().max(320),
      phone: z.string().trim().min(1).max(500).nullable(),
    }).strict()).max(STAFF_LEAD_SEARCH_MAX_LIMIT),
  })
  .strict();

export const planningStudentSearchSuccessSchema = z
  .object({
    items: z.array(z.object({
      userId: safeOpaqueIdSchema,
      displayName: z.string().trim().min(1).max(300),
      email: z.string().trim().email().max(320).nullable(),
    }).strict()).max(50),
  })
  .strict();

export type PlanningStudentSearchSuccess = z.infer<typeof planningStudentSearchSuccessSchema>;
export type PlanningStudentSearchRequest = z.infer<typeof planningStudentSearchRequestSchema>;
export type StaffLeadSearchRequest = z.infer<typeof staffLeadSearchRequestSchema>;
