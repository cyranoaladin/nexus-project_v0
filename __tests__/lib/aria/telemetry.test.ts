import {
  ariaConversationTelemetryEventSchema,
  classifyAriaLatency,
} from '@/lib/aria/domain/observability/telemetry';

const baseEvent = {
  schemaVersion: 1,
  event: 'COMPLETED',
  requestId: 'req-server-generated',
  turnId: 'turn-1',
  conversationId: 'conversation-1',
  courseKey: 'eds-nsi-terminale',
  pedagogicalMode: 'GUIDED_PRACTICE',
  agentRole: 'TUTOR',
  visibility: 'STUDENT_PRIVATE',
  ragStatus: 'SUCCESS',
  modelPolicy: 'ARIA_CHAT_DEFAULT_V1',
  durationMs: 120,
  latencyClass: 'NOMINAL',
  finalState: 'COMPLETED',
} as const;

describe('ARIA privacy-safe structured telemetry', () => {
  it('U063 accepts only bounded operational identifiers and labels', () => {
    expect(ariaConversationTelemetryEventSchema.parse(baseEvent)).toEqual(baseEvent);
  });

  it.each(['message', 'prompt', 'email', 'userId', 'studentId', 'providerPayload']) (
    'rejects the raw sensitive field %s',
    (field) => {
      expect(() => ariaConversationTelemetryEventSchema.parse({
        ...baseEvent,
        [field]: 'sensitive-value',
      })).toThrow();
    },
  );

  it('classifies observed durations without exposing high-cardinality metrics', () => {
    expect(classifyAriaLatency('RETRIEVAL', 99)).toBe('FAST');
    expect(classifyAriaLatency('RETRIEVAL', 1_500)).toBe('NOMINAL');
    expect(classifyAriaLatency('RETRIEVAL', 5_001)).toBe('TIMEOUT');
  });
});
