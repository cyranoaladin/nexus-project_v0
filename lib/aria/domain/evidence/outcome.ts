/**
 * Validated shape of `LearningEvidence.outcome`, keyed by
 * `LearningEvidenceSource`. Pure domain layer: no Prisma, no I/O.
 *
 * These shapes are deliberately minimal and provisional: no real producer
 * (Practice, Correction, conversation-assessment) exists yet — each future
 * lot may need to extend its own source's shape when it's built. Extend the
 * relevant schema below rather than loosening validation or accepting
 * free-form JSON; every source must keep a real, checked shape.
 */

import { z } from 'zod';
import type { LearningEvidenceSource } from '@prisma/client';
import { AriaError } from '../../kernel/errors';

const practiceOutcomeSchema = z.object({
  outcome: z.enum(['CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT']),
  activityAttemptId: z.string().min(1),
}).strict();

const assessmentResultSchema = z.object({
  score: z.number().min(0),
  maxScore: z.number().positive(),
  assessmentAttemptId: z.string().min(1),
}).strict();

const conversationAssessmentSchema = z.object({
  assessment: z.enum(['STRONG', 'DEVELOPING', 'STRUGGLING']),
  turnId: z.string().min(1),
}).strict();

const correctionResultSchema = z.object({
  outcome: z.enum(['CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT']),
  correctionId: z.string().min(1),
  feedbackSummary: z.string().min(1).max(2000),
}).strict();

const humanObservationSchema = z.object({
  note: z.string().min(1).max(2000),
  observedByUserId: z.string().min(1),
}).strict();

const examSimulationSchema = z.object({
  score: z.number().min(0),
  maxScore: z.number().positive(),
  examSimulationId: z.string().min(1),
}).strict();

const OUTCOME_SCHEMA_BY_SOURCE = {
  PRACTICE_ATTEMPT: practiceOutcomeSchema,
  ASSESSMENT_RESULT: assessmentResultSchema,
  CONVERSATION_ASSESSMENT: conversationAssessmentSchema,
  CORRECTION_RESULT: correctionResultSchema,
  TEACHER_OBSERVATION: humanObservationSchema,
  COACH_FEEDBACK: humanObservationSchema,
  EXAM_SIMULATION: examSimulationSchema,
} satisfies Record<LearningEvidenceSource, z.ZodTypeAny>;

export type PracticeAttemptOutcome = z.infer<typeof practiceOutcomeSchema>;
export type AssessmentResultOutcome = z.infer<typeof assessmentResultSchema>;
export type ConversationAssessmentOutcome = z.infer<typeof conversationAssessmentSchema>;
export type CorrectionResultOutcome = z.infer<typeof correctionResultSchema>;
export type HumanObservationOutcome = z.infer<typeof humanObservationSchema>;
export type ExamSimulationOutcome = z.infer<typeof examSimulationSchema>;

export type LearningEvidenceOutcome =
  | PracticeAttemptOutcome
  | AssessmentResultOutcome
  | ConversationAssessmentOutcome
  | CorrectionResultOutcome
  | HumanObservationOutcome
  | ExamSimulationOutcome;

/** Fail-closed: throws on an unrecognized source or a malformed outcome. */
export function parseLearningEvidenceOutcome(
  source: LearningEvidenceSource,
  outcome: unknown,
): LearningEvidenceOutcome {
  const schema = OUTCOME_SCHEMA_BY_SOURCE[source];
  if (!schema) {
    throw new AriaError('BAD_REQUEST', 400, `Source de LearningEvidence inconnue: ${String(source)}`);
  }
  const parsed = schema.safeParse(outcome);
  if (!parsed.success) {
    throw new AriaError(
      'BAD_REQUEST',
      400,
      `Forme d'outcome invalide pour la source ${source}.`,
      parsed.error.flatten(),
    );
  }
  return parsed.data as LearningEvidenceOutcome;
}
