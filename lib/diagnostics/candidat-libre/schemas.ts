import { z } from 'zod';

export const diagnosticAnswerValueSchema = z.union([
  z.string().max(20_000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(500)).max(30),
  z.null(),
]);

export const diagnosticAnswerSchema = z.object({
  questionId: z.string().min(1).max(160),
  value: diagnosticAnswerValueSchema,
  status: z.enum(['ANSWERED', 'NOT_STUDIED', 'SKIPPED']).optional(),
  confidence: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  answeredAt: z.string().datetime().optional(),
}).strict();

export const moduleDraftSchema = z.object({
  answers: z.record(z.string().max(160), diagnosticAnswerSchema).default({}),
  currentQuestionIndex: z.number().int().min(0).max(1_000).default(0),
  elapsedMs: z.number().int().min(0).max(24 * 60 * 60 * 1_000).default(0),
  integrity: z.object({
    accepted: z.boolean(),
    focusLossCount: z.number().int().min(0).max(10_000).default(0),
    fullscreenExitCount: z.number().int().min(0).max(10_000).default(0),
    copyPasteCount: z.number().int().min(0).max(10_000).default(0),
  }).strict(),
  action: z.enum(['draft', 'submit']).default('draft'),
  clientMutationId: z.string().min(8).max(160),
}).strict();

export const createDiagnosticSchema = z.object({
  targetSession: z.number().int().min(2027).max(2032).default(2027),
  source: z.enum(['STUDENT_DASHBOARD', 'PARENT_DASHBOARD', 'STAFF']).default('STUDENT_DASHBOARD'),
  studentId: z.string().min(1).max(160).optional(),
}).strict();

export const updateDiagnosticProfileSchema = z.object({
  targetSession: z.number().int().min(2027).max(2032).optional(),
  studentConsent: z.boolean().optional(),
  metadata: z.record(z.string().max(80), z.union([
    z.string().max(4_000),
    z.number().finite(),
    z.boolean(),
    z.array(z.string().max(500)).max(50),
    z.null(),
  ])).optional(),
}).strict();

export const parentQuestionnaireSchema = z.object({
  answers: z.record(z.string().max(160), diagnosticAnswerSchema).default({}),
  action: z.enum(['draft', 'submit']).default('draft'),
  consent: z.boolean(),
  clientMutationId: z.string().min(8).max(160),
}).strict();

export const routeIdSchema = z.string().min(1).max(160);
export const moduleKeySchema = z.string().regex(/^[a-z0-9-]+$/).max(100);

export const documentMetadataSchema = z.object({
  category: z.enum([
    'IDENTITY',
    'CYCLADES',
    'FRENCH_BAC_TRANSCRIPT',
    'TUNISIAN_BAC_TRANSCRIPT',
    'SCHOOL_REPORT',
    'EXAM_ACCOMMODATION',
    'WRITTEN_COPY',
    'ORAL_RECORDING',
    'OTHER',
  ]),
  title: z.string().min(1).max(200),
  description: z.string().max(1_000).optional(),
  clientMutationId: z.string().min(8).max(160),
}).strict();

export type ModuleDraftInput = z.infer<typeof moduleDraftSchema>;
export type ParentQuestionnaireInput = z.infer<typeof parentQuestionnaireSchema>;
