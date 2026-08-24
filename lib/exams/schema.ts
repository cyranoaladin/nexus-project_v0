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

const coefficientModaliteBSchema = z.union([
  z.object({ premiere: z.number().int().positive(), terminale: z.number().int().positive() }).strict(),
  z.literal('À_VERIFIER'),
]);

const coefficientParModaliteSchema = z
  .object({
    A: z.number().int().positive(),
    B: coefficientModaliteBSchema,
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
    coefficientParModalite: coefficientParModaliteSchema.optional(),
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
    perteDeMention: z.literal(true),
    sourceMention: z.string().trim().min(1),
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

const dispensePartiePratiqueSchema = z
  .object({
    specialitesConcernees: z.array(z.string().trim().min(1)).min(1),
    sourceArticle: z.string().trim().min(1),
    note: z.string().trim().min(1),
  })
  .strict();

const basculeScolaireSchema = z
  .object({
    branches: z
      .array(
        z
          .object({
            id: z.enum(['conservation_moyennes_premiere', 'renonciation_moyennes_premiere']),
            label: z.string().trim().min(1),
            consequence: z.string().trim().min(1),
          })
          .strict(),
      )
      .length(2),
    sourceNote: z.string().trim().min(1),
  })
  .strict();

const dispensesTitulaireBacSchema = z
  .object({
    sourceArticle: z.string().trim().min(1),
    perimetre: z.literal('declaratif'),
    note: z.string().trim().min(1),
  })
  .strict();

const secondGroupeSchema = z
  .object({
    moyenneMin: z.number().min(0).max(20),
    moyenneMax: z.number().min(0).max(20),
    nombreDisciplines: z.number().int().positive(),
    note: z.string().trim().min(1),
  })
  .strict();

const candidatIndividuelRulesSchema = z
  .object({
    controleContinuReplacedBy: z.literal('evaluations_ponctuelles'),
    ponctuellesModality: ponctuellesModalitySchema,
    noteConservation: noteConservationSchema,
    sameSessionEligibility: sameSessionEligibilitySchema,
    dispensePartiePratique: dispensePartiePratiqueSchema,
    basculeScolaireVersIndividuel: basculeScolaireSchema,
    dispensesTitulaireBac: dispensesTitulaireBacSchema,
    secondGroupe: secondGroupeSchema,
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
    verifieLe: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const sessionStatusSchema = z.enum(['ACTIVE', 'HISTORICAL_READONLY', 'SKELETON_UNCONFIRMED']);

export const examPolicySchema = z
  .object({
    session: z.number().int().positive(),
    track: z.literal('bac_general'),
    status: sessionStatusSchema,
    validFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    lastVerifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    verifiedBy: z.string().trim().min(1),
    sources: z.array(sourceSchema).min(1),
    epreuves: z.array(epreuveSchema),
    totalCoefficient: z.number().int().min(0),
    candidatIndividuelRules: z.union([candidatIndividuelRulesSchema, z.literal('À_VERIFIER')]),
    tunisiaSpecific: z.union([tunisiaSpecificSchema, z.literal('À_VERIFIER')]),
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
    if (policy.status !== 'SKELETON_UNCONFIRMED') {
      if (policy.epreuves.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `session ${policy.session} has status ${policy.status} but an empty epreuves array — only a SKELETON_UNCONFIRMED session may have zero épreuves`,
        });
      } else {
        const sumCoefficients = policy.epreuves.reduce((sum, e) => sum + e.coefficient, 0);
        if (sumCoefficients !== policy.totalCoefficient) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `sum of epreuve coefficients (${sumCoefficients}) !== totalCoefficient (${policy.totalCoefficient})`,
          });
        }
      }
    }
    for (const ep of policy.epreuves) {
      const cm = ep.coefficientParModalite;
      if (cm && typeof cm.B === 'object') {
        const sumB = cm.B.premiere + cm.B.terminale;
        if (sumB !== cm.A) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${ep.id}: coefficientParModalite.B (${cm.B.premiere}+${cm.B.terminale}=${sumB}) must sum to coefficientParModalite.A (${cm.A})`,
          });
        }
      }
    }
    if (typeof policy.candidatIndividuelRules === 'object') {
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
    }
  });

export type ExamPolicy = z.infer<typeof examPolicySchema>;
export type Epreuve = ExamPolicy['epreuves'][number];
export type ResolvedCandidatIndividuelRules = Exclude<ExamPolicy['candidatIndividuelRules'], string>;
export type EligibilityCondition = ResolvedCandidatIndividuelRules['sameSessionEligibility']['conditions'][number];
