/**
 * Zod schema for the versioned exam-rules canonical data (data/exams/*.json).
 *
 * Every regulatory fact the quote engine relies on must come from a file
 * validated against this schema — coefficients, épreuve timing, and the
 * same-session eligibility conditions are never hardcoded in components or
 * in the domain engine itself. See CDC §11/§12.
 */
import { z } from 'zod';

const sourceSchema = z
  .object({
    label: z.string().trim().min(1),
    url: z.string().trim().url(),
    note: z.string().trim().min(1),
  })
  .strict();

const epreuveSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, 'epreuve id must be an ASCII kebab-case slug'),
    label: z.string().trim().min(1),
    type: z.enum(['anticipe', 'terminal', 'ponctuel']),
    coefficient: z.number().int().positive(),
    timing: z.enum(['fin_premiere', 'fin_terminale', 'selon_modalite']),
    introducedSession: z.number().int().positive().optional(),
    note: z.string().trim().min(1).optional(),
  })
  .strict();

const ponctuellesModalitySchema = z
  .object({
    choiceGranularity: z.literal('global_not_per_subject'),
    chosenAtRegistrationLevel: z.enum(['premiere', 'terminale']),
    options: z
      .array(
        z
          .object({
            id: z.string().trim().min(1),
            label: z.string().trim().min(1),
          })
          .strict(),
      )
      .min(2),
    note: z.string().trim().min(1),
  })
  .strict();

const noteConservationSchema = z
  .object({
    thresholdOutOf20: z.number().int().min(0).max(20),
    validSessions: z.number().int().positive(),
    note: z.string().trim().min(1),
  })
  .strict();

const eligibilityConditionSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    autoCheckable: z.boolean(),
    note: z.string().trim().min(1).optional(),
  })
  .strict();

const sameSessionEligibilitySchema = z
  .object({
    sourceArticle: z.string().trim().min(1),
    sourceUrl: z.string().trim().url(),
    generalRule: z.string().trim().min(1),
    conditions: z.array(eligibilityConditionSchema).min(1),
    engineRule: z.string().trim().min(1),
  })
  .strict();

const candidatIndividuelRulesSchema = z
  .object({
    controleContinuReplacedBy: z.literal('evaluations_ponctuelles'),
    ponctuellesModality: ponctuellesModalitySchema,
    noteConservation: noteConservationSchema,
    sameSessionEligibility: sameSessionEligibilitySchema,
  })
  .strict();

const tunisiaSpecificSchema = z
  .object({
    registrationPortal: z.string().trim().min(1),
    academieDeRattachement: z.string().trim().min(1),
    localContact: z.string().trim().min(1),
    registrationWindowNote: z.string().trim().min(1),
    feesNote: z.string().trim().min(1),
    confidence: z.enum(['CONFIRMED', 'LIKELY', 'UNCERTAIN']),
  })
  .strict();

export const examPolicySchema = z
  .object({
    session: z.number().int().positive(),
    track: z.literal('bac_general'),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    lastVerifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    verifiedBy: z.string().trim().min(1),
    sources: z.array(sourceSchema).min(1),
    epreuves: z.array(epreuveSchema).min(1),
    totalCoefficient: z.number().int().positive(),
    candidatIndividuelRules: candidatIndividuelRulesSchema,
    tunisiaSpecific: tunisiaSpecificSchema,
  })
  .strict()
  .superRefine((policy, ctx) => {
    const ids = policy.epreuves.map((e) => e.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate epreuve ids: ${duplicates.join(', ')}`,
      });
    }
    const sumCoefficients = policy.epreuves.reduce((sum, e) => sum + e.coefficient, 0);
    if (sumCoefficients !== policy.totalCoefficient) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `sum of epreuve coefficients (${sumCoefficients}) !== totalCoefficient (${policy.totalCoefficient})`,
      });
    }
    const autoCheckableIds = new Set(
      policy.candidatIndividuelRules.sameSessionEligibility.conditions
        .filter((c) => c.autoCheckable)
        .map((c) => c.id),
    );
    if (autoCheckableIds.size === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'sameSessionEligibility must have at least one autoCheckable condition, otherwise the engine can never confirm eligibility programmatically',
      });
    }
  });

export type ExamPolicy = z.infer<typeof examPolicySchema>;
export type Epreuve = ExamPolicy['epreuves'][number];
export type EligibilityCondition = ExamPolicy['candidatIndividuelRules']['sameSessionEligibility']['conditions'][number];
