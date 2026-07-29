import { GradeLevel, Subject } from '@prisma/client';
import { z } from 'zod';

const compactIdentifierSchema = z.string().trim().min(1).max(160);
const shortTextSchema = z.string().trim().min(1).max(80);
const boundedReasonSchema = z.string().trim().min(1).max(1_000);

export const CURRENT_BILAN_CONSENT_VERSION = 'bilan-public-v1' as const;

function emptyStringToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }, schema.optional());
}

function normalizeParentPhone(value: string): string {
  const compact = value.replace(/[\s()-]/g, '');

  if (/^[2-9]\d{7}$/.test(compact)) {
    return `+216${compact}`;
  }

  if (/^216[2-9]\d{7}$/.test(compact)) {
    return `+${compact}`;
  }

  return compact;
}

function isValidE164ParentPhone(value: string): boolean {
  if (value.startsWith('+216')) {
    return /^\+216[2-9]\d{7}$/.test(value);
  }

  return /^\+[1-9]\d{7,14}$/.test(value);
}

const parentPhoneSchema = z.string()
  .trim()
  .min(8)
  .max(32)
  .transform(normalizeParentPhone)
  .refine(isValidE164ParentPhone, 'Numéro de téléphone invalide');

export const bilanParentContactSchema = z.object({
  firstName: shortTextSchema,
  lastName: shortTextSchema,
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: parentPhoneSchema,
}).strict();

export const bilanChildSchema = z.object({
  firstName: shortTextSchema,
  lastName: emptyStringToUndefined(shortTextSchema),
  schoolName: emptyStringToUndefined(z.string().trim().min(1).max(160)),
}).strict();

export const bilanRequestAdmissionSchema = z.object({
  parent: bilanParentContactSchema,
  child: bilanChildSchema,
  schoolYear: z.literal('2026-2027'),
  level: z.nativeEnum(GradeLevel),
  subject: z.nativeEnum(Subject),
  mainNeed: z.string().trim().min(1).max(500),
  message: emptyStringToUndefined(z.string().trim().min(1).max(1_000)),
  consent: z.literal(true),
  consentVersion: z.literal(CURRENT_BILAN_CONSENT_VERSION),
}).strict();

export const bilanVerifiedParentChildCommandSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('SELECT_EXISTING'),
    studentId: compactIdentifierSchema,
  }).strict(),
  z.object({
    action: z.literal('CREATE_NEW'),
    child: bilanChildSchema,
  }).strict(),
]);

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
export type BilanVerifiedParentChildCommand = z.infer<
  typeof bilanVerifiedParentChildCommandSchema
>;
export type BilanTeamAssignmentInput = z.infer<typeof bilanTeamAssignmentSchema>;
export type BilanTeamReviewInput = z.infer<typeof bilanTeamReviewSchema>;
export type BilanTeamOperationalActionInput = z.infer<typeof bilanTeamOperationalActionSchema>;
