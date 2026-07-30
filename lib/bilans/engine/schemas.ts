import { z } from 'zod';

const identifierSchema = z.string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
const checksumSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime({ offset: true });

export const idempotencyKeySchema = z.string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const assignmentCommandSchema = z.object({
  requestId: identifierSchema,
  studentId: identifierSchema,
  definitionId: identifierSchema,
  definitionVersion: z.string().trim().min(1).max(160),
  definitionChecksum: checksumSchema,
  opensAt: timestampSchema,
  dueAt: timestampSchema.nullish(),
  maxAttempts: z.number().int().min(1).max(10),
}).strict().superRefine(({ dueAt, opensAt }, context) => {
  if (dueAt && new Date(dueAt).getTime() <= new Date(opensAt).getTime()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'dueAt must be later than opensAt',
      path: ['dueAt'],
    });
  }
});

const selectedOptionResponseSchema = z.object({
  selectedOptionIndex: z.number().int().min(0).max(3),
  textValue: z.never().optional(),
}).strict();

const textResponseSchema = z.object({
  selectedOptionIndex: z.never().optional(),
  textValue: z.string().trim().min(1).max(2_000),
}).strict();

export const autosaveCommandSchema = z.object({
  attemptId: identifierSchema,
  itemId: identifierSchema,
  expectedVersion: z.number().int().min(0),
  response: z.union([selectedOptionResponseSchema, textResponseSchema]),
}).strict();

export const submitCommandSchema = z.object({
  attemptId: identifierSchema,
}).strict();

export const manualReviewDecisionCommandSchema = z.object({
  taskId: identifierSchema,
  expectedClaimVersion: z.number().int().min(1),
  awardedPoints: z.number().min(0).max(1),
  internalComment: z.string().trim().max(2_000).optional(),
  publishableComment: z.string().trim().max(1_000).optional(),
  rubricVersion: z.string().trim().min(1).max(160),
}).strict();

export type AssignmentCommand = z.infer<typeof assignmentCommandSchema>;
export type AutosaveCommand = z.infer<typeof autosaveCommandSchema>;
export type SubmitCommand = z.infer<typeof submitCommandSchema>;
export type ManualReviewDecisionCommand =
  z.infer<typeof manualReviewDecisionCommandSchema>;
