/**
 * Validated shapes for `ActivityVersion.prompt` / `.expectedAnswerShape` /
 * `.correctionRubric`, keyed by `ActivityType`. Pure domain layer: no
 * Prisma, no I/O — mirrors `lib/aria/domain/evidence/outcome.ts` exactly.
 *
 * Only MCQ and SHORT_ANSWER are implemented in this lot — the remaining
 * ActivityType values exist in the schema (so a future lot doesn't need a
 * migration to add them) but are deliberately RESERVED, the same activation
 * pattern `data/aria/pedagogical-policies.v1.json` already uses for inactive
 * pedagogical modes: named, real, and explicitly refused rather than
 * silently mis-validated against a guessed shape. Activating one means
 * adding its real schema here, never loosening validation to accept it.
 */

import { z } from 'zod';
import { AriaError } from '../../kernel/errors';

/** Mirrors the real `ActivityType` Prisma enum by value (H003: this pure domain layer must not import `@prisma/client`). */
export type ActivityType =
  | 'MCQ'
  | 'SHORT_ANSWER'
  | 'STRUCTURED_RESPONSE'
  | 'PROBLEM'
  | 'DOCUMENT_ANALYSIS'
  | 'CODE';

export const ACTIVE_ACTIVITY_TYPES: readonly ActivityType[] = Object.freeze(['MCQ', 'SHORT_ANSWER']);

const mcqOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(500),
}).strict();

const mcqPromptSchema = z.object({
  questionText: z.string().min(1).max(4000),
  options: z.array(mcqOptionSchema).min(2).max(10),
}).strict();

const mcqExpectedAnswerShapeSchema = z.object({
  field: z.literal('selectedOptionId'),
  type: z.literal('string'),
}).strict();

const mcqCorrectionRubricSchema = z.object({
  correctOptionId: z.string().min(1),
}).strict();

const mcqResponsePayloadSchema = z.object({
  selectedOptionId: z.string().min(1),
}).strict();

const shortAnswerPromptSchema = z.object({
  questionText: z.string().min(1).max(4000),
}).strict();

const shortAnswerExpectedAnswerShapeSchema = z.object({
  field: z.literal('answerText'),
  type: z.literal('string'),
}).strict();

const shortAnswerCorrectionRubricSchema = z.object({
  acceptableAnswers: z.array(z.string().min(1)).min(1).max(20),
  caseSensitive: z.boolean(),
}).strict();

const shortAnswerResponsePayloadSchema = z.object({
  answerText: z.string().min(1).max(4000),
}).strict();

interface ActivityContentSchemas {
  readonly prompt: z.ZodTypeAny;
  readonly expectedAnswerShape: z.ZodTypeAny;
  readonly correctionRubric: z.ZodTypeAny;
  readonly responsePayload: z.ZodTypeAny;
}

const SCHEMAS_BY_TYPE: Partial<Record<ActivityType, ActivityContentSchemas>> = Object.freeze({
  MCQ: Object.freeze({
    prompt: mcqPromptSchema,
    expectedAnswerShape: mcqExpectedAnswerShapeSchema,
    correctionRubric: mcqCorrectionRubricSchema,
    responsePayload: mcqResponsePayloadSchema,
  }),
  SHORT_ANSWER: Object.freeze({
    prompt: shortAnswerPromptSchema,
    expectedAnswerShape: shortAnswerExpectedAnswerShapeSchema,
    correctionRubric: shortAnswerCorrectionRubricSchema,
    responsePayload: shortAnswerResponsePayloadSchema,
  }),
});

function requireActiveSchemas(activityType: ActivityType): ActivityContentSchemas {
  const schemas = SCHEMAS_BY_TYPE[activityType];
  if (!schemas) {
    throw new AriaError(
      'UNSUPPORTED',
      422,
      `Le type d'activité ${activityType} n'est pas encore disponible.`,
      { reasonCode: 'ARIA_ACTIVITY_TYPE_RESERVED' },
    );
  }
  return schemas;
}

function parseWithSchema<T>(schema: z.ZodTypeAny, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AriaError('BAD_REQUEST', 400, `Forme de ${label} invalide.`, parsed.error.flatten());
  }
  return parsed.data as T;
}

export interface ValidatedActivityContent {
  readonly prompt: unknown;
  readonly expectedAnswerShape: unknown;
  readonly correctionRubric: unknown;
}

/** Fail-closed: throws on a reserved/unknown type or any malformed field. */
export function parseActivityContent(
  activityType: ActivityType,
  content: { readonly prompt: unknown; readonly expectedAnswerShape: unknown; readonly correctionRubric: unknown },
): ValidatedActivityContent {
  const schemas = requireActiveSchemas(activityType);
  return Object.freeze({
    prompt: parseWithSchema(schemas.prompt, content.prompt, 'prompt'),
    expectedAnswerShape: parseWithSchema(schemas.expectedAnswerShape, content.expectedAnswerShape, 'expectedAnswerShape'),
    correctionRubric: parseWithSchema(schemas.correctionRubric, content.correctionRubric, 'correctionRubric'),
  });
}

/** Fail-closed: throws if the type is reserved or the payload doesn't match this type's real response shape. */
export function parseActivityResponsePayload(activityType: ActivityType, payload: unknown): unknown {
  const schemas = requireActiveSchemas(activityType);
  return parseWithSchema(schemas.responsePayload, payload, 'réponse');
}
