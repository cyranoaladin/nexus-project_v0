import { z } from 'zod';
import { ARIA_PEDAGOGICAL_MODES } from '../domain/pedagogy/pedagogical-mode';
import { ARIA_PERFORMANCE_BUDGETS } from '../domain/observability/performance-budgets';

export const ariaTurnStatusSchema = z.enum([
  'PENDING', 'RUNNING', 'COMPLETED', 'CANCELLED', 'ERROR',
]);
export const ariaExecutionStatusSchema = z.enum(['RUNNING', 'COMPLETED', 'CANCELLED', 'ERROR']);
export const ariaExecutionDispositionSchema = z.enum(['IN_PROGRESS', 'REPLAY', 'EXECUTED']);
export const ariaRagStatusSchema = z.enum([
  'NOT_CONFIGURED', 'NO_RESULTS', 'RUNTIME_UNAVAILABLE', 'SUCCESS',
]);

export const ariaChatRequestSchema = z
  .object({
    clientRequestId: z.string().uuid(),
    courseKey: z.string().min(1),
    skillId: z.string().min(1).optional(),
    resourceId: z.string().min(1).optional(),
    conversationId: z.string().min(1).optional(),
    pedagogicalMode: z.enum(ARIA_PEDAGOGICAL_MODES).optional(),
    content: z
      .string()
      .min(1, 'Message requis')
      .max(ARIA_PERFORMANCE_BUDGETS.messageCharactersMax, 'Message trop long')
      .refine((value) => value.trim().length > 0, 'Message vide non autorisé'),
  })
  .strict();

export type AriaChatRequest = z.infer<typeof ariaChatRequestSchema>;

export const ariaCancelRequestSchema = z.object({
  clientRequestId: z.string().uuid(),
}).strict();

const paginationFields = {
  cursor: z.string().min(1).max(1_024).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};

export const ariaConversationListQuerySchema = z.union([
  z.object({
    courseKey: z.string().min(1),
    contextState: z.literal('ACTIVE').optional().default('ACTIVE'),
    ...paginationFields,
  }).strict(),
  z.object({
    contextState: z.literal('LEGACY_CONTEXT_UNRESOLVED'),
    ...paginationFields,
  }).strict(),
]);

export const ariaConversationMessagesQuerySchema = z.object({
  ...paginationFields,
}).strict();

export function strictSearchParams(searchParams: URLSearchParams): Record<string, string> {
  const record: Record<string, string> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    if (values.length !== 1) throw new Error('ARIA_QUERY_PARAMETER_DUPLICATED');
    record[key] = values[0];
  }
  return record;
}

export const ariaCitationPayloadSchema = z.object({
  id: z.string().min(1),
  resourceId: z.string().min(1),
  resourceVersionId: z.string().min(1),
  contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  chunkId: z.string().min(1),
  locator: z.record(z.union([z.string(), z.number(), z.boolean()])),
  corpusId: z.string().min(1),
  corpusVersionId: z.string().min(1),
  manifestSha256: z.string().regex(/^[0-9a-f]{64}$/),
  sourceTitle: z.string().min(1),
  sourceDocument: z.string().min(1),
  sourceLocation: z.string().optional(),
  courseKey: z.string().min(1),
  provenance: z.string().min(1),
  url: z.string().url().optional(),
  snippet: z.string(),
  score: z.number().optional(),
}).strict();

export const ariaSSEStartSchema = z.object({
  turnId: z.string().min(1),
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  courseKey: z.string().min(1),
  status: ariaExecutionStatusSchema,
  disposition: ariaExecutionDispositionSchema,
}).strict();

export const ariaSSEDeltaSchema = z.object({ text: z.string() }).strict();
export const ariaSSECitationSchema = z.object({ citation: ariaCitationPayloadSchema }).strict();
export const ariaSSEMetadataSchema = z.object({
  turnId: z.string().min(1),
  courseKey: z.string().min(1),
  status: ariaExecutionStatusSchema,
  disposition: ariaExecutionDispositionSchema,
  ragStatus: ariaRagStatusSchema.optional(),
}).strict();
export const ariaSSEDoneSchema = z.object({
  turnId: z.string().min(1),
  messageId: z.string().min(1),
  status: z.enum(['COMPLETED', 'CANCELLED']),
  fullText: z.string(),
}).strict();
export const ariaSSEErrorSchema = z.object({
  code: z.enum([
    'RAG_UNAVAILABLE', 'MODEL_UNAVAILABLE', 'INTERNAL_ERROR',
  ]),
  requestId: z.string().min(1),
  retryable: z.boolean(),
}).strict();
export const ariaSSEHeartbeatSchema = z.object({
  timestamp: z.string().datetime(),
}).strict();

export const ariaSSEEventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('start'), data: ariaSSEStartSchema }).strict(),
  z.object({ event: z.literal('delta'), data: ariaSSEDeltaSchema }).strict(),
  z.object({ event: z.literal('citation'), data: ariaSSECitationSchema }).strict(),
  z.object({ event: z.literal('metadata'), data: ariaSSEMetadataSchema }).strict(),
  z.object({ event: z.literal('done'), data: ariaSSEDoneSchema }).strict(),
  z.object({ event: z.literal('error'), data: ariaSSEErrorSchema }).strict(),
  z.object({ event: z.literal('heartbeat'), data: ariaSSEHeartbeatSchema }).strict(),
]);

export type AriaSSEEvent = z.infer<typeof ariaSSEEventSchema>;
export type AriaSSEStartPayload = z.infer<typeof ariaSSEStartSchema>;
export type AriaSSEDeltaPayload = z.infer<typeof ariaSSEDeltaSchema>;
export type AriaSSECitationPayload = z.infer<typeof ariaSSECitationSchema>;
export type AriaSSEMetadataPayload = z.infer<typeof ariaSSEMetadataSchema>;
export type AriaSSEDonePayload = z.infer<typeof ariaSSEDoneSchema>;
export type AriaSSEErrorPayload = z.infer<typeof ariaSSEErrorSchema>;
export type AriaSSEHeartbeatPayload = z.infer<typeof ariaSSEHeartbeatSchema>;
