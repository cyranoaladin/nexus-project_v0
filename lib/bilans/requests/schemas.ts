import { GradeLevel, Subject } from '@prisma/client';
import { z } from 'zod';

const compactIdentifierSchema = z.string().trim().min(1).max(160);
const shortTextSchema = z.string().trim().min(1).max(80);
const boundedReasonSchema = z.string().trim().min(1).max(1_000);

const parentPhoneSchema = z.string()
  .trim()
  .min(8)
  .max(32)
  .refine((value) => {
    const normalized = value.replace(/[\s()-]/g, '');
    return /^\+?[1-9]\d{7,14}$/.test(normalized);
  }, 'Numéro de téléphone invalide')
  .transform((value) => value.replace(/[\s()-]/g, ''));

export const bilanParentContactSchema = z.object({
  firstName: shortTextSchema,
  lastName: shortTextSchema,
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: parentPhoneSchema,
}).strict();

export const bilanChildSchema = z.object({
  firstName: shortTextSchema,
  lastName: shortTextSchema.optional(),
  schoolName: z.string().trim().min(1).max(160).optional(),
}).strict();

export const bilanRequestAdmissionSchema = z.object({
  parent: bilanParentContactSchema,
  child: bilanChildSchema,
  schoolYear: z.literal('2026-2027'),
  level: z.nativeEnum(GradeLevel),
  subject: z.nativeEnum(Subject),
  mainNeed: z.string().trim().min(1).max(500),
  message: z.string().trim().min(1).max(1_000).optional(),
  consent: z.literal(true),
  consentVersion: z.string().trim().min(1).max(64),
}).strict();

export const bilanTeamAssignmentSchema = z.object({
  coachId: compactIdentifierSchema,
}).strict();

export const bilanTeamReviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: boundedReasonSchema.optional(),
}).strict().superRefine(({ decision, note }, context) => {
  if (decision === 'REJECT' && !note) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Un motif est requis pour refuser le bilan',
      path: ['note'],
    });
  }
});

export const bilanTeamOperationalActionSchema = z.object({
  action: z.enum(['MARK_HUMAN_FOLLOWUP', 'RETRY_TECHNICAL', 'CANCEL']),
  reason: boundedReasonSchema,
}).strict();

export type BilanRequestAdmission = z.infer<typeof bilanRequestAdmissionSchema>;
export type BilanChildInput = z.infer<typeof bilanChildSchema>;
export type BilanTeamAssignmentInput = z.infer<typeof bilanTeamAssignmentSchema>;
export type BilanTeamReviewInput = z.infer<typeof bilanTeamReviewSchema>;
export type BilanTeamOperationalActionInput = z.infer<typeof bilanTeamOperationalActionSchema>;
