import { z } from 'zod';

import {
  BILAN_ERROR_CODES,
  LIFECYCLE_ACTORS,
  LIFECYCLE_STATUSES,
} from './types';

export const bilanErrorCodeSchema = z.enum(BILAN_ERROR_CODES);

const isoTimestampSchema = z.string().datetime({ offset: true });
const identifierSchema = z.string().trim().min(1).max(160);

export const catalogRefSchema = z.object({
  id: identifierSchema,
  subject: z.enum(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'FRANCAIS', 'SVT', 'SES']),
  level: z.enum(['SECONDE', 'PREMIERE', 'TERMINALE']),
  version: z.string().trim().min(1).max(64),
}).strict();

const answerSchema = z.object({
  questionId: identifierSchema,
  answer: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
}).strict();

export const attemptSubmissionSchema = z.object({
  attemptId: identifierSchema,
  catalog: catalogRefSchema,
  answers: z.array(answerSchema).min(1),
  submittedAt: isoTimestampSchema,
}).strict();

export const scoreSnapshotSchema = z.object({
  attemptId: identifierSchema,
  algorithmVersion: z.string().trim().min(1).max(64),
  totalScore: z.number().finite().nonnegative(),
  maxScore: z.number().finite().positive(),
  scoredAt: isoTimestampSchema,
}).strict().superRefine(({ totalScore, maxScore }, context) => {
  if (totalScore > maxScore) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'totalScore cannot exceed maxScore',
      path: ['totalScore'],
    });
  }
});

export const evidenceItemSchema = z.object({
  skillId: identifierSchema,
  status: z.enum(['MASTERED', 'IN_PROGRESS', 'NOT_ACQUIRED']),
  rationale: z.string().trim().min(1).max(2_000),
}).strict();

export const reportRevisionSchema = z.object({
  id: identifierSchema,
  attemptId: identifierSchema,
  revision: z.number().int().positive(),
  status: z.enum(['REPORT_PENDING_REVIEW', 'COACH_VALIDATED', 'COACH_REJECTED', 'PUBLISHED']),
  generatedAt: isoTimestampSchema,
  validatedAt: isoTimestampSchema.optional(),
  evidence: z.array(evidenceItemSchema),
}).strict().superRefine(({ status, validatedAt }, context) => {
  if ((status === 'COACH_VALIDATED' || status === 'PUBLISHED') && !validatedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validatedAt is required for validated or published revisions',
      path: ['validatedAt'],
    });
  }
});

export const notificationEventSchema = z.object({
  id: identifierSchema,
  type: z.enum(['QUESTIONNAIRE_SUBMITTED', 'BILAN_GENERATED', 'BILAN_PUBLISHED']),
  recipientRole: z.enum(['STUDENT', 'PARENT', 'COACH']),
  channel: z.literal('WHATSAPP'),
  occurredAt: isoTimestampSchema,
}).strict();

export const lifecycleStatusSchema = z.enum(LIFECYCLE_STATUSES);
export const lifecycleActorSchema = z.enum(LIFECYCLE_ACTORS);
