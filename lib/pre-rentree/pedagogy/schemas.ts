import { z } from 'zod';

import { CONTENT_PUBLICATION_STATUSES } from './types';

const nonEmptyString = z.string().min(1);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const sourcePath = z.string().regex(
  /^content\/pre-rentree-2026\/pedagogy\/(?:positioning\/(?:SPEC-tests-positionnement-pre-stage-2026\.md|REFERENTIEL-CANONIQUE-2026\.yaml|curriculum-anchors\.yaml|cps\/[a-z0-9-]+\.yaml)|session-kits\/(?:MANIFESTE-SEANCES\.csv|modules\/[a-z0-9-]+\/(?:README\.md|s0[1-5]-[a-z0-9-]+\/(?:banques-eleve|corrige-commente|verification-eleve|verification-correction)\.md)))$/,
);

export const levelSchema = z.enum([
  'QUATRIEME',
  'TROISIEME',
  'SECONDE',
  'PREMIERE',
  'TERMINALE',
]);

export const subjectSchema = z.enum([
  'MATHEMATIQUES',
  'FRANCAIS',
  'NSI',
  'PHYSIQUE_CHIMIE',
  'SVT',
  'MATHS_EXPERTES',
  'PHILOSOPHIE',
]);

export const publicationStatusSchema = z.enum(CONTENT_PUBLICATION_STATUSES);

const moduleSessionSchema = z.object({
  number: z.number().int().min(1).max(5),
  title: nonEmptyString,
  objective: nonEmptyString,
  topics: z.array(nonEmptyString).min(1),
  method: nonEmptyString,
  deliverable: nonEmptyString,
}).strict();

export const moduleCatalogSchema = z.object({
  version: nonEmptyString,
  generatedAt: nonEmptyString,
  resourcePolicy: z.object({
    generatedDefaultStatus: publicationStatusSchema,
    classroomReadyRequiresHumanValidation: z.boolean(),
    promotionRule: nonEmptyString,
  }).strict(),
  modules: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    publicationStatus: nonEmptyString,
    objective: nonEmptyString.optional(),
    equipment: nonEmptyString.optional(),
    level: levelSchema,
    subjectId: subjectSchema,
    subject: nonEmptyString,
    title: nonEmptyString,
    subtitle: nonEmptyString,
    prerequisites: nonEmptyString,
    differentiation: nonEmptyString,
    quickAssessment: nonEmptyString,
    sessions: z.array(moduleSessionSchema).length(5),
  }).strict()).min(1),
}).strict();

const fileSourceSchema = z.object({
  path: sourcePath,
  sha256,
}).strict();

const humanValidationSchema = z.object({
  status: publicationStatusSchema,
  reviewer: z.string().min(1).nullable(),
  validatedAt: z.string().datetime().nullable(),
  requiredRoles: z.array(z.enum([
    'responsable-pedagogique',
    'enseignant-disciplinaire',
  ])).min(2),
  required: z.boolean(),
}).strict();

const manifestSessionSchema = z.object({
  number: z.number().int().min(1).max(5),
  path: z.string().regex(
    /^content\/pre-rentree-2026\/pedagogy\/session-kits\/modules\/[a-z0-9-]+\/s0[1-5]-[a-z0-9-]+$/,
  ),
  files: z.array(fileSourceSchema).length(4),
}).strict();

export const pedagogyManifestSchema = z.object({
  version: z.number().int().positive(),
  campaignId: z.literal('pre-rentree-2026'),
  publicationStatus: publicationStatusSchema,
  moduleCatalog: z.literal('../modules.json'),
  counts: z.object({
    modules: z.number().int().positive(),
    sessions: z.number().int().positive(),
    cps: z.number().int().positive(),
    nodes: z.number().int().positive(),
    evaluatedNodes: z.number().int().positive(),
    items: z.number().int().positive(),
    manualResponses: z.number().int().nonnegative(),
    sessionUnitFiles: z.number().int().positive(),
    sessionsPerModule: z.number().int().positive(),
  }).strict(),
  positioning: z.object({
    cpsDirectory: z.literal('positioning/cps'),
    expectedCps: z.number().int().positive(),
  }).strict(),
  sessionKits: z.object({
    modulesDirectory: z.literal('session-kits/modules'),
    expectedModules: z.number().int().positive(),
    expectedSessions: z.number().int().positive(),
  }).strict(),
  generatedOutputs: z.object({
    root: z.literal('.artifacts/pre-rentree-2026/pedagogy/generated'),
  }).strict(),
  sharedSources: z.array(fileSourceSchema).min(1),
  modules: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    level: levelSchema,
    subject: subjectSchema,
    cps: fileSourceSchema,
    readme: fileSourceSchema,
    sessions: z.array(manifestSessionSchema).length(5),
    expectedOutputs: z.array(nonEmptyString).length(6),
    editorialStatus: publicationStatusSchema,
    humanValidation: humanValidationSchema,
  }).strict()).min(1),
  humanValidation: humanValidationSchema,
}).strict();

const propositionSchema = z.object({
  texte: nonEmptyString,
  correcte: z.boolean(),
  obstacleVise: z.number().int().nonnegative().optional(),
}).strict();

const qcmItemSchema = z.object({
  id: z.string().regex(/^n[0-9]{2}-i[1-3]$/),
  palier: z.enum(['A', 'B', 'C']),
  type: z.literal('qcm_unique'),
  enonce: nonEmptyString,
  justification: nonEmptyString,
  propositions: z.array(propositionSchema).length(4),
}).strict();

const manualItemSchema = z.object({
  id: z.string().regex(/^n[0-9]{2}-i[1-3]$/),
  palier: z.enum(['A', 'B', 'C']),
  type: z.literal('reponse_courte'),
  enonce: nonEmptyString,
  justification: nonEmptyString,
  correctionManuelle: z.literal(true),
  excluScoringAutomatique: z.literal(true),
  longueurMaxCaracteres: z.number().int().positive(),
  criteresCorrection: z.array(nonEmptyString).min(3),
  exempleReponseAdmissible: nonEmptyString,
}).strict();

const assessmentNodeSchema = z.object({
  id: z.string().regex(/^n[0-9]{2}$/),
  ordre: z.number().int().positive(),
  evalueParTest: z.boolean(),
  acquisN1: nonEmptyString,
  usageN: nonEmptyString,
  obstacles: z.array(nonEmptyString).min(1),
  critereMaitrise: nonEmptyString,
  seanceRattachement: z.number().int().min(1).max(5).nullable(),
  items: z.array(z.discriminatedUnion('type', [
    qcmItemSchema,
    manualItemSchema,
  ])).length(3).optional(),
  motifNonEvalue: nonEmptyString.optional(),
  commentairePedagogique: nonEmptyString.optional(),
  prioriteAbsolue: z.boolean().optional(),
}).strict().superRefine((node, context) => {
  if (node.evalueParTest && (!node.items || node.seanceRattachement === null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'evaluated nodes require items and a session',
    });
  }
  if (!node.evalueParTest && (node.items || !node.motifNonEvalue)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'non-evaluated nodes require a reason and no items',
    });
  }
});

export const assessmentDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  niveauEntree: levelSchema,
  matiere: subjectSchema,
  edition: z.number().int().positive(),
  dureeCibleMinutes: z.number().int().min(20).max(25),
  gamme: z.enum(['FONDATIONS', 'PREMIUM']),
  intitulePublic: nonEmptyString,
  cadrage: nonEmptyString,
  statutValidation: publicationStatusSchema,
  noeuds: z.array(assessmentNodeSchema).min(1),
}).strict();

export type RawModuleCatalog = z.infer<typeof moduleCatalogSchema>;
export type RawPedagogyManifest = z.infer<typeof pedagogyManifestSchema>;
export type RawAssessmentDefinition = z.infer<typeof assessmentDefinitionSchema>;
