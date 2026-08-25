/**
 * Zod validation for the assistante-workspace candidat-individuel API
 * (mission recâblage §5). No such schema existed before this module
 * (confirmed by search) — lib/exams/normalize.ts only validates that
 * resolved *values* are known codes, never that a request body has the
 * right *shape*; that boundary check belongs here, at the API layer,
 * matching the .strict() pattern already used by app/api/quotes/route.ts.
 */
import { z } from 'zod';

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
    publicInput: publicCandidateInputRawSchema,
    staffExtension: staffExtensionSchema.optional(),
    budget: budgetInputSchema,
    diagnostic: diagnosticInputSchema.nullish(),
    monthsRemaining: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export const requestReviewBodySchema = z
  .object({
    note: z.string().max(2000).nullish(),
  })
  .strict();
