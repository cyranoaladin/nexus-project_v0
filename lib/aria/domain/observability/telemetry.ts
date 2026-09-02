import { z } from 'zod';
import { ARIA_PEDAGOGICAL_MODES } from '../pedagogy/pedagogical-mode';
import { ARIA_PERFORMANCE_BUDGETS } from './performance-budgets';

export const ariaTelemetryOperationSchema = z.enum([
  'START',
  'RETRIEVAL',
  'MODEL',
  'FINALIZE',
  'COMPLETED',
  'CANCELLED',
  'ERROR',
  'TIMEOUT',
  'RECOVERY',
]);

export const ariaLatencyClassSchema = z.enum(['FAST', 'NOMINAL', 'SLOW', 'TIMEOUT']);

export const ariaConversationTelemetryEventSchema = z.object({
  schemaVersion: z.literal(1),
  event: ariaTelemetryOperationSchema,
  requestId: z.string().min(1).max(128),
  turnId: z.string().min(1).max(128),
  conversationId: z.string().min(1).max(128),
  courseKey: z.string().min(1).max(128),
  pedagogicalMode: z.enum(ARIA_PEDAGOGICAL_MODES),
  agentRole: z.literal('TUTOR'),
  visibility: z.literal('STUDENT_PRIVATE'),
  ragStatus: z.enum(['NOT_CONFIGURED', 'NO_RESULTS', 'RUNTIME_UNAVAILABLE', 'SUCCESS']).optional(),
  modelPolicy: z.string().min(1).max(64),
  durationMs: z.number().finite().nonnegative().max(24 * 60 * 60 * 1_000),
  timeToFirstTokenMs: z.number().finite().nonnegative().max(24 * 60 * 60 * 1_000).optional(),
  latencyClass: ariaLatencyClassSchema,
  finalState: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'CANCELLED', 'ERROR']).optional(),
  reasonCode: z.string().regex(/^[A-Z0-9_]+$/).max(80).optional(),
}).strict();

export type AriaConversationTelemetryEvent = z.infer<typeof ariaConversationTelemetryEventSchema>;

export interface AriaConversationTelemetrySink {
  record(event: AriaConversationTelemetryEvent): void;
}

export function classifyAriaLatency(
  operation: 'CONTEXT' | 'RETRIEVAL' | 'MODEL_FIRST_TOKEN' | 'MODEL_TOTAL' | 'FINALIZE',
  durationMs: number,
): z.infer<typeof ariaLatencyClassSchema> {
  const timeout = operation === 'RETRIEVAL'
    ? ARIA_PERFORMANCE_BUDGETS.ragTimeoutMs
    : operation === 'MODEL_FIRST_TOKEN'
      ? ARIA_PERFORMANCE_BUDGETS.firstTokenTimeoutMs
      : operation === 'MODEL_TOTAL'
        ? ARIA_PERFORMANCE_BUDGETS.totalModelTimeoutMs
        : operation === 'CONTEXT'
          ? ARIA_PERFORMANCE_BUDGETS.contextWarmP95Ms
          : ARIA_PERFORMANCE_BUDGETS.fixtureOverheadP95Ms;
  if (durationMs > timeout) return 'TIMEOUT';
  if (durationMs <= Math.min(100, timeout / 4)) return 'FAST';
  if (durationMs <= timeout * 0.75) return 'NOMINAL';
  return 'SLOW';
}

export function recordAriaTelemetry(
  sink: AriaConversationTelemetrySink,
  event: AriaConversationTelemetryEvent,
): void {
  sink.record(ariaConversationTelemetryEventSchema.parse(event));
}
