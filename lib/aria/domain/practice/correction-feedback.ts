/**
 * Validated shape for `ActivityResult.feedback` — the model's structured
 * correction, never free-form prose. Pure domain layer: no Prisma, no I/O
 * (H003), mirrors `lib/aria/domain/evidence/outcome.ts` and
 * `lib/aria/domain/practice/activity-content.ts` exactly.
 *
 * `outcome` is validated separately by `ActivityOutcome` (mirrors the real
 * Prisma enum by value, same reasoning as `activity-content.ts`'s
 * `ActivityType` mirror).
 */

import { z } from 'zod';
import { AriaError } from '../../kernel/errors';

/** Mirrors the real `ActivityOutcome` Prisma enum by value (H003). */
export type ActivityOutcome = 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT';

export const ACTIVITY_OUTCOMES: readonly ActivityOutcome[] = Object.freeze([
  'CORRECT',
  'PARTIALLY_CORRECT',
  'INCORRECT',
]);

const correctionFeedbackSchema = z.object({
  outcome: z.enum(['CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT']),
  summary: z.string().min(1).max(1000),
  strengths: z.array(z.string().min(1).max(500)).max(10),
  improvements: z.array(z.string().min(1).max(500)).max(10),
}).strict();

export type CorrectionFeedback = z.infer<typeof correctionFeedbackSchema>;

/**
 * Fail-closed: throws on malformed/incomplete model output rather than
 * silently coercing it into a fake-valid correction. The caller
 * (`correct-attempt.ts`) is responsible for deciding whether to retry once
 * with a stricter re-prompt before giving up — this function itself never
 * guesses at a missing field.
 */
export function parseModelCorrectionOutput(raw: unknown): CorrectionFeedback {
  const parsed = correctionFeedbackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AriaError(
      'INTERNAL_ERROR',
      500,
      'La correction générée par le modèle est invalide.',
      { reasonCode: 'ARIA_CORRECTION_OUTPUT_INVALID', issues: parsed.error.flatten() },
    );
  }
  return parsed.data;
}

/**
 * The model is asked to respond with raw JSON text (see
 * `correct-attempt.ts`'s prompt construction) — this parses that text into
 * an object before validation, failing closed (not silently) if it isn't
 * even valid JSON.
 */
export function parseModelCorrectionJson(rawText: string): CorrectionFeedback {
  let candidate: unknown;
  try {
    candidate = JSON.parse(rawText);
  } catch {
    throw new AriaError(
      'INTERNAL_ERROR',
      500,
      'La réponse du modèle de correction n’est pas un JSON valide.',
      { reasonCode: 'ARIA_CORRECTION_OUTPUT_NOT_JSON' },
    );
  }
  return parseModelCorrectionOutput(candidate);
}
