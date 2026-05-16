import { z } from 'zod';

const MAX_PAYLOAD_SIZE = 200 * 1024; // 200 KB

/**
 * Zod schema for validating NSI progress payload before server storage.
 * Only allowed top-level keys are accepted. Forbidden keys are explicitly rejected.
 */
const nsiProgressDataSchema = z
  .object({
    subjects: z.record(z.string(), z.object({
      status: z.string().optional(),
      lastWorkedAt: z.string().optional(),
    }).passthrough()).default({}),
    patterns: z.record(z.string(), z.object({
      mastered: z.boolean().optional(),
      writtenByHand: z.boolean().optional(),
      lastPracticedAt: z.string().optional(),
    }).passthrough()).default({}),
    flashcards: z.record(z.string(), z.object({
      level: z.number().optional(),
      lastReviewedAt: z.string().optional(),
    }).passthrough()).default({}),
    fiveDayPlan: z.record(z.string(), z.object({
      completed: z.boolean().optional(),
    }).passthrough()).default({}),
    selfAssessment: z.record(z.string(), z.object({
      status: z.string().optional(),
    }).passthrough()).default({}),
    mockExams: z.array(z.object({
      subjectId: z.number(),
      date: z.string(),
      duration: z.number().optional(),
    }).passthrough()).default([]),
    oralPhrases: z.record(z.string(), z.object({
      contract: z.string().optional(),
      strategy: z.string().optional(),
      edgeCase: z.string().optional(),
      test: z.string().optional(),
      markedAsExplained: z.boolean().optional(),
    }).passthrough()).default({}),
  })
  .strict(); // Reject unknown keys at top level

const FORBIDDEN_KEYS = ['userId', 'email', 'password', 'token', 'role', 'secret', 'apiKey'];

export type ValidationResult =
  | { valid: true; data: z.infer<typeof nsiProgressDataSchema> }
  | { valid: false; error: string };

/**
 * Validate and sanitize NSI progress data for server storage.
 * Returns validated data or an error message.
 */
export function validateNsiProgressPayload(data: unknown): ValidationResult {
  // Check type
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, error: 'data must be a non-null object' };
  }

  // Check forbidden keys
  const keys = Object.keys(data);
  for (const key of keys) {
    if (FORBIDDEN_KEYS.includes(key)) {
      return { valid: false, error: `Forbidden key: ${key}` };
    }
  }

  // Check serialized size
  const serialized = JSON.stringify(data);
  if (serialized.length > MAX_PAYLOAD_SIZE) {
    return { valid: false, error: 'Payload too large (max 200KB)' };
  }

  // Validate with Zod
  const result = nsiProgressDataSchema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.errors[0];
    return { valid: false, error: `Invalid data: ${firstError?.path.join('.')} - ${firstError?.message}` };
  }

  return { valid: true, data: result.data };
}
