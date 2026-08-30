/**
 * Zod validation for the assistante-workspace candidat-individuel API
 * (mission recâblage §5). No such schema existed before this module
 * (confirmed by search) — lib/exams/normalize.ts only validates that
 * resolved *values* are known codes, never that a request body has the
 * right *shape*; that boundary check belongs here, at the API layer,
 * matching the .strict() pattern already used by app/api/quotes/route.ts.
 */
import { z } from 'zod';
import { validateLanguagePair } from '@/lib/exams/languages';
import { validateSpecialityFields } from '@/lib/exams/specialities';

const publicCandidateInputRawSchema = z
  .object({
    level: z.string().nullish(),
    examSession: z.number().int().nullish(),
    modalite: z.string().nullish(),
    specialite1: z.string().nullish(),
    specialite2: z.string().nullish(),
    specialiteAbandonnee: z.string().nullish(),
    langueA: z.string().nullish(),
    langueB: z.string().nullish(),
    optionsTerminale: z.array(z.string()).optional(),
    estRedoublant: z.boolean().optional(),
    estTitulaireBacDejaObtenu: z.boolean().optional(),
    changementSpecialite: z.boolean().optional(),
    intentionAmelioration: z.boolean().optional(),
    intentionCycleComplet: z.boolean().optional(),
    moyenneRattrapage: z.number().nullish(),
    etalementPlurisessionsDeclare: z.boolean().optional(),
    brancheBascule: z.string().nullish(),
  })
  .strict();

const simulatablePublicCandidateInputSchema = publicCandidateInputRawSchema.superRefine((input, context) => {
    const issues = [
      ...validateSpecialityFields(input),
      ...validateLanguagePair(input.langueA, input.langueB).issues,
    ];
    for (const issue of issues) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [issue.field],
        message: issue.message,
        params: { domainCode: issue.code },
      });
    }
  });

const reconductionAuditSchema = z
  .object({
    mecanismeDeclare: z.enum(['CONSERVATION_DEMANDEE', 'RECONDUCTION_AUTOMATIQUE_DECLAREE', 'INDETERMINE']),
    statutVerification: z.enum(['NON_VERIFIEE', 'VERIFIEE', 'REFUSEE']),
    justificatifRef: z.string().optional(),
    validateurUserId: z.string().optional(),
    dateValidation: z.string().optional(),
    sourceReglementaire: z.string().optional(),
    sessionOrigine: z.number().int().optional(),
    sessionCible: z.number().int().optional(),
    commentaire: z.string().optional(),
  })
  .strict();

const staffNoteInputRawSchema = z
  .object({
    epreuveId: z.string().min(1),
    note: z.number(),
    sessionObtention: z.number().int(),
    mecanisme: z.enum(['CONSERVATION_DEMANDEE', 'RECONDUCTION_AUTOMATIQUE_CONFIRMEE', 'INDETERMINE']),
    reconductionAudit: reconductionAuditSchema.nullish(),
  })
  .strict();

const staffDispenseInputRawSchema = z
  .object({
    epreuveId: z.string().min(1),
    statut: z.enum(['DECLAREE', 'CONFIRMEE', 'REFUSEE']),
    justificatifRef: z.string().optional(),
  })
  .strict();

const p3EligibiliteAuditSchema = z
  .object({
    motif: z.string().min(1),
    faitsDeclares: z.boolean(),
    justificatifRequis: z.boolean(),
    justificatifFourni: z.string().optional(),
    justificatifValide: z.boolean(),
    decision: z.enum(['CONFIRMEE', 'REFUSEE', 'EN_ATTENTE']),
    validateurUserId: z.string().optional(),
    dateDecision: z.string().optional(),
    sourceReglementaire: z.string().min(1),
  })
  .strict();

const staffExtensionSchema = z
  .object({
    notesConservees: z.array(staffNoteInputRawSchema).nullish(),
    dispensesDeclarees: z.array(staffDispenseInputRawSchema).nullish(),
    p3EligibiliteAudit: z.array(p3EligibiliteAuditSchema).nullish(),
  })
  .strict();

const budgetInputSchema = z
  .object({
    monthlyBudgetTnd: z.number().positive(),
    strategy: z.enum(['RESPECT_BUDGET', 'BEST_BALANCE', 'MOST_COMPLETE']),
  })
  .strict();

const diagnosticDomainScoreSchema = z
  .object({
    points: z.number(),
    maxPoints: z.number(),
    percentage: z.number().nullable(),
  })
  .strict();

const diagnosticInputSchema = z
  .object({
    raw: z.record(z.string(), diagnosticDomainScoreSchema),
    overconfidentDomainKeys: z.array(z.string()).optional(),
  })
  .strict();

export const profilCandidatDraftBodySchema = z
  .object({
    publicInput: publicCandidateInputRawSchema,
    staffExtension: staffExtensionSchema.optional(),
    contactLeadId: z.string().nullish(),
    studentId: z.string().nullish(),
  })
  .strict();

export const candidatIndividuelSimulateBodySchema = z
  .object({
    publicInput: simulatablePublicCandidateInputSchema,
    staffExtension: staffExtensionSchema.optional(),
    budget: budgetInputSchema,
    diagnostic: diagnosticInputSchema.nullish(),
    monthsRemaining: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export const createQuoteFromProfilBodySchema = z
  .object({
    idempotencyKey: z.string().min(8).max(200),
    budget: budgetInputSchema,
    diagnostic: diagnosticInputSchema.nullish(),
    monthsRemaining: z.number().int().min(1).max(10).optional(),
    scenarioTier: z.enum(['ESSENTIEL', 'RECOMMANDE', 'COMPLET']),
    marginOverride: z
      .object({
        reason: z.string().min(1).max(2000),
      })
      .nullish(),
    /**
     * T2 — CANDIDAT INDIVIDUEL HEADCOUNT & GROUP STATE SAFETY (direction
     * decision registry, commit 4ffaac8ed), keyed per-subject since the
     * T2-closeout review (post-294a885d6, HEADCOUNT_CARDINALITY =
     * PER_GROUP_HEADCOUNT_REQUIRED): independent GROUPE subjects
     * (Maths/LVA/LVB...) are independent cohorts, each with its own
     * confirmed headcount — a single scenario-wide value was a domain
     * modeling error. Keyed by RecommendedLine.subject (the existing
     * stable per-line identity). Staff-declared, never derived
     * automatically — no workflow today aggregates real enrolled headcount
     * across candidates for the same subject/session (see
     * resolveScenarioEffectiveGroupPricing's own doc comment). An entry
     * for a subject not present in the scenario is harmless (ignored). A
     * GROUPE-modality line whose subject has no entry here blocks
     * creation with GROUP_PENDING rather than silently pricing at the
     * catalogue GROUPE rate as if the group were already confirmed.
     */
    confirmedHeadcountBySubject: z.record(z.string(), z.number().int().positive()).optional(),
  })
  .strict();

export const requestReviewBodySchema = z
  .object({
    note: z.string().max(2000).nullish(),
  })
  .strict();
