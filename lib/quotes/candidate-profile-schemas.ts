/**
 * Candidate Profile Regulatory Schemas (SSOT).
 *
 * Provides strict domain validation schemas for candidate academic profiles:
 * - dispensesDeclarees (P7 dispensation declarations)
 * - notesConservees (D. 334-13 / D. 334-7-1 conserved grades and reconduction audits)
 * - p3EligibiliteAudit (P3 Article 3 same-session derogation audit trails)
 * - Strict recursive JSON primitives for arbitrary JSON payloads without unsafe casts.
 *
 * Single Source of Truth shared across POST, PATCH, persistence service, and tests.
 */
import { z } from 'zod';
import { Subject } from '@prisma/client';
import { getSupportedSessions } from '@/lib/exams/catalog';
import { KNOWN_SPECIALITIES } from '@/lib/exams/specialities';
import { isLanguageCode } from '@/lib/exams/languages';

/* ------------------------------------------------------------------
   1. Strict Recursive JSON Types & Schemas
   ------------------------------------------------------------------ */

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export const jsonLiteralSchema: z.ZodType<JsonPrimitive> = z.union([
  z.string(),
  z.number().refine((n) => Number.isFinite(n), { message: 'Number must be finite' }),
  z.boolean(),
  z.null(),
]);

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    jsonLiteralSchema,
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

/* ------------------------------------------------------------------
   2. Regulatory Domain Schemas
   ------------------------------------------------------------------ */

/** P7 dispense declaration schema — tracks DECLAREE / CONFIRMEE / REFUSEE */
export const dispenseDeclareeSchema = z
  .object({
    epreuveId: z.string().trim().min(1).max(80),
    statut: z.enum(['DECLAREE', 'CONFIRMEE', 'REFUSEE']),
    justificatifRef: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type DispenseDeclaree = z.infer<typeof dispenseDeclareeSchema>;

/** Audit trail for RECONDUCTION_AUTOMATIQUE_CONFIRMEE (Article D. 334-7-1) */
export const reconductionAuditSchema = z
  .object({
    mecanismeDeclare: z.enum(['CONSERVATION_DEMANDEE', 'RECONDUCTION_AUTOMATIQUE_DECLAREE', 'INDETERMINE']),
    statutVerification: z.enum(['NON_VERIFIEE', 'VERIFIEE', 'REFUSEE']),
    justificatifRef: z.string().trim().min(1).max(120).optional(),
    validateurUserId: z.string().trim().min(1).max(80).optional(),
    dateValidation: z.string().trim().min(1).max(40).optional(),
    sourceReglementaire: z.string().trim().min(1).max(200).optional(),
    sessionOrigine: z.number().int().min(2015).max(2035).optional(),
    sessionCible: z.number().int().min(2015).max(2035).optional(),
    commentaire: z.string().trim().max(500).optional(),
  })
  .strict();

export type ReconductionAudit = z.infer<typeof reconductionAuditSchema>;

/** Conserved grade entry schema */
export const noteConserveeSchema = z
  .object({
    epreuveId: z.string().trim().min(1).max(80),
    note: z.number().min(0).max(20),
    sessionObtention: z.number().int().min(2015).max(2035),
    mecanisme: z.enum(['CONSERVATION_DEMANDEE', 'RECONDUCTION_AUTOMATIQUE_CONFIRMEE', 'INDETERMINE']),
    reconductionAudit: reconductionAuditSchema.nullable().optional(),
  })
  .strict();

export type NoteConservee = z.infer<typeof noteConserveeSchema>;

/** Staff audit trail for non-autoCheckable P3 conditions (Article 3) */
export const p3EligibiliteAuditEntrySchema = z
  .object({
    motif: z.string().trim().min(1).max(100),
    faitsDeclares: z.boolean(),
    justificatifRequis: z.boolean(),
    justificatifFourni: z.string().trim().min(1).max(120).optional(),
    justificatifValide: z.boolean(),
    decision: z.enum(['CONFIRMEE', 'REFUSEE', 'EN_ATTENTE']),
    validateurUserId: z.string().trim().min(1).max(80).optional(),
    dateDecision: z.string().trim().min(1).max(40).optional(),
    sourceReglementaire: z.string().trim().min(1).max(200),
  })
  .strict();

export type P3EligibiliteAuditEntry = z.infer<typeof p3EligibiliteAuditEntrySchema>;

/* ------------------------------------------------------------------
   3. Candidate Profile Route Schemas (POST & PATCH)
   ------------------------------------------------------------------ */

const subjectEnum = z.nativeEnum(Subject);

/** Base fields shared across creation and revision */
const candidateProfileFields = {
  level: z.enum(['PREMIERE', 'TERMINALE']),
  examSession: z
    .number()
    .int()
    .refine((s) => (getSupportedSessions() as number[]).includes(s), {
      message: 'Unsupported examSession; must match a registered exam policy',
    }),
  modalite: z.enum(['A', 'B']),
  specialite1: subjectEnum.refine((s) => KNOWN_SPECIALITIES.has(s), {
    message: 'Invalid speciality for specialite1',
  }),
  specialite2: subjectEnum.refine((s) => KNOWN_SPECIALITIES.has(s), {
    message: 'Invalid speciality for specialite2',
  }),
  specialiteAbandonnee: subjectEnum
    .refine((s) => KNOWN_SPECIALITIES.has(s), { message: 'Invalid speciality for specialiteAbandonnee' })
    .optional(),
  langueA: subjectEnum
    .refine((s) => isLanguageCode(s), { message: 'Invalid language for langueA' })
    .optional(),
  langueB: subjectEnum
    .refine((s) => isLanguageCode(s), { message: 'Invalid language for langueB' })
    .optional(),
  estRedoublant: z.boolean().optional(),
  estTitulaireBacDejaObtenu: z.boolean().optional(),
  changementSpecialite: z.boolean().optional(),
  intentionAmelioration: z.boolean().optional(),
  intentionCycleComplet: z.boolean().optional(),
  brancheBascule: z.enum(['CONSERVATION_MOYENNES_PREMIERE', 'RENONCIATION_MOYENNES_PREMIERE']).optional(),
  optionsTerminale: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  moyenneRattrapage: z.number().min(0).max(20).nullable().optional(),
  etalementPlurisessionsDeclare: z.boolean().optional(),
  epreuvesDispenseesDeclarees: z.array(z.string().trim().min(1).max(80)).optional(),
  dispensesDeclarees: z.array(dispenseDeclareeSchema).optional(),
  notesConservees: z.array(noteConserveeSchema).optional(),
  p3EligibiliteAudit: z.array(p3EligibiliteAuditEntrySchema).optional(),
};

/** Academic facts shared by canonical profile creation and transactional family creation. */
export const candidateProfileAcademicSchema = z.object(candidateProfileFields).strict();

/** Schema for POST /api/assistante/candidate-profiles */
export const createProfilCandidatSchema = z
  .object({
    contactLeadId: z.string().trim().min(1).max(80).optional(),
    studentId: z.string().trim().min(1).max(80).optional(),
    ...candidateProfileFields,
  })
  .strict()
  .refine((v) => Boolean(v.contactLeadId) !== Boolean(v.studentId), {
    message: 'Exactly one of contactLeadId/studentId is required',
  })
  .refine((v) => v.specialite1 !== v.specialite2, {
    message: 'specialite1 and specialite2 must be distinct',
    path: ['specialite2'],
  });

export type CreateProfilCandidatPayload = z.infer<typeof createProfilCandidatSchema>;

/** Schema for PATCH /api/assistante/candidate-profiles/[id] */
export const reviseProfilCandidatSchema = z
  .object({
    level: candidateProfileFields.level.optional(),
    examSession: candidateProfileFields.examSession.optional(),
    modalite: candidateProfileFields.modalite.optional(),
    specialite1: candidateProfileFields.specialite1.optional(),
    specialite2: candidateProfileFields.specialite2.optional(),
    specialiteAbandonnee: candidateProfileFields.specialiteAbandonnee.nullable().optional(),
    langueA: candidateProfileFields.langueA.nullable().optional(),
    langueB: candidateProfileFields.langueB.nullable().optional(),
    estRedoublant: candidateProfileFields.estRedoublant.optional(),
    estTitulaireBacDejaObtenu: candidateProfileFields.estTitulaireBacDejaObtenu.optional(),
    changementSpecialite: candidateProfileFields.changementSpecialite.optional(),
    intentionAmelioration: candidateProfileFields.intentionAmelioration.optional(),
    intentionCycleComplet: candidateProfileFields.intentionCycleComplet.optional(),
    brancheBascule: candidateProfileFields.brancheBascule.nullable().optional(),
    optionsTerminale: candidateProfileFields.optionsTerminale.optional(),
    moyenneRattrapage: candidateProfileFields.moyenneRattrapage.optional(),
    etalementPlurisessionsDeclare: candidateProfileFields.etalementPlurisessionsDeclare.optional(),
    epreuvesDispenseesDeclarees: candidateProfileFields.epreuvesDispenseesDeclarees.optional(),
    dispensesDeclarees: z.array(dispenseDeclareeSchema).nullable().optional(),
    notesConservees: z.array(noteConserveeSchema).nullable().optional(),
    p3EligibiliteAudit: z.array(p3EligibiliteAuditEntrySchema).nullable().optional(),
  })
  .strict()
  .refine(
    (v) => {
      if (v.specialite1 && v.specialite2) return v.specialite1 !== v.specialite2;
      return true;
    },
    {
      message: 'specialite1 and specialite2 must be distinct',
      path: ['specialite2'],
    },
  );

export type ReviseProfilCandidatPayload = z.infer<typeof reviseProfilCandidatSchema>;
