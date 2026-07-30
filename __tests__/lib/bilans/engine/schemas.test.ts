import {
  assignmentCommandSchema,
  autosaveCommandSchema,
  idempotencyKeySchema,
} from '@/lib/bilans/engine';

describe('assessment engine command schemas', () => {
  it('requires bounded opaque idempotency keys', () => {
    expect(idempotencyKeySchema.safeParse('short').success).toBe(false);
    expect(idempotencyKeySchema.safeParse('valid_key-123456').success).toBe(true);
    expect(idempotencyKeySchema.safeParse('invalid key 123456').success).toBe(false);
  });

  it('rejects extra assignment fields and incoherent windows', () => {
    const base = {
      requestId: 'request-1',
      studentId: 'student-1',
      definitionId: 'definition-1',
      definitionVersion: 'version-1',
      definitionChecksum: `sha256:${'a'.repeat(64)}`,
      opensAt: '2026-08-01T08:00:00.000Z',
      dueAt: '2026-07-31T08:00:00.000Z',
      maxAttempts: 1,
    };
    expect(assignmentCommandSchema.safeParse(base).success).toBe(false);
    expect(assignmentCommandSchema.safeParse({
      ...base,
      dueAt: '2026-08-02T08:00:00.000Z',
      injected: true,
    }).success).toBe(false);
  });

  it('bounds text responses and enforces one response representation', () => {
    expect(autosaveCommandSchema.safeParse({
      attemptId: 'attempt-1',
      itemId: 'item-1',
      expectedVersion: 0,
      response: { selectedOptionIndex: 1, textValue: 'both' },
    }).success).toBe(false);
    expect(autosaveCommandSchema.safeParse({
      attemptId: 'attempt-1',
      itemId: 'item-1',
      expectedVersion: 0,
      response: { textValue: 'a'.repeat(2_001) },
    }).success).toBe(false);
  });
});
