/**
 * AI-driven correction of a submitted ARIA Practice attempt (P2b). Closes
 * the loop P2a deliberately left open: a SUBMITTED attempt gets corrected by
 * a real model call, producing a structured `ActivityResult`, and — for the
 * first time in this build-out — writes a real `PRACTICE_ATTEMPT` row into
 * `LearningEvidence` (P1). P2a never wrote evidence: it had no outcome to
 * record honestly. This is where that outcome finally exists.
 *
 * Idempotency: `repository.beginCorrection` is a short, lock-guarded check
 * BEFORE any model call — an already-corrected attempt returns its existing
 * result, never re-calling the model. The model call itself happens OUTSIDE
 * any held lock/transaction (it's slow, real network I/O). After a
 * response, `repository.commitCorrectionResult` re-checks under the same
 * lock scope (double-checked locking) before writing, so two concurrent
 * correction requests can each call the model once but only one of them
 * ever writes — the `attemptId` `@unique` constraint on `ActivityResult` is
 * the final, unconditional guarantee.
 */
import { streamChatCompletion, type ChatMessage } from '../../gateway';
import { AriaError } from '../../kernel/errors';
import { resolveInteractiveStudentActor } from '../../kernel/actor-subject';
import { recordLearningEvidence } from '../evidence/record';
import { authorizePracticeCorrectionForActor } from './authorize';
import { buildCorrectionPromptMessages } from './correction-prompt';
import { parseModelCorrectionJson } from '../../domain/practice/correction-feedback';
import { prismaActivityRepository } from '../../infrastructure/prisma/activity-repository';
import type { ActivityRepository, ActivityResultRecord } from './ports';

export interface AriaPracticeCorrectInput {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly attemptId: string;
}

export interface CorrectModelDependency {
  (messages: readonly ChatMessage[]): AsyncIterable<string>;
}

async function collectModelText(stream: AsyncIterable<string>): Promise<string> {
  let text = '';
  for await (const token of stream) {
    text += token;
  }
  return text;
}

export function makeCorrectAriaPracticeAttempt(dependencies: {
  readonly repository: ActivityRepository;
  readonly streamModel: CorrectModelDependency;
}) {
  return async function correctAriaPracticeAttempt(
    input: AriaPracticeCorrectInput,
  ): Promise<{ readonly result: ActivityResultRecord; readonly alreadyCorrected: boolean }> {
    const { repository } = dependencies;
    const actor = resolveInteractiveStudentActor(input.actor);
    const studentId = await repository.resolveStudentIdByUserId(actor.userId);
    if (!studentId) {
      throw new AriaError('NOT_ENROLLED', 403, 'Profil élève introuvable.');
    }

    const attempt = await repository.getAttemptById(input.attemptId);
    // Same shape whether the attempt doesn't exist or belongs to someone
    // else — never reveal which, to a requester who isn't the owner.
    if (!attempt || attempt.studentId !== studentId) {
      throw new AriaError('BAD_REQUEST', 404, 'Tentative introuvable.');
    }

    // Dual gate re-checked at correction time (not just at attempt-start):
    // course access + the CURRENT `practiceCorrection` tier capability —
    // correction triggers a new, real model call, unlike submission.
    await authorizePracticeCorrectionForActor({
      actor: input.actor,
      courseKey: attempt.courseKey,
    });

    const begin = await repository.beginCorrection(input.attemptId);
    if (begin.alreadyCorrected) {
      return { result: begin.result, alreadyCorrected: true };
    }

    const activity = await repository.getActivityById(attempt.activityId);
    if (!activity) {
      throw new AriaError('INTERNAL_ERROR', 500, 'Activité de la tentative introuvable.', {
        reasonCode: 'ARIA_ATTEMPT_ACTIVITY_MISSING',
      });
    }
    // The EXACT version this attempt/response were created against — never
    // the activity's current active version, which may have since changed
    // (see the port's own doc comment on getVersionById).
    const version = await repository.getVersionById(attempt.activityVersionId);
    if (!version) {
      throw new AriaError('INTERNAL_ERROR', 500, 'Version de l’activité introuvable.', {
        reasonCode: 'ARIA_ATTEMPT_VERSION_MISSING',
      });
    }
    const response = await repository.getResponseByAttemptId(input.attemptId);
    if (!response) {
      throw new AriaError('INTERNAL_ERROR', 500, 'Réponse de la tentative introuvable.', {
        reasonCode: 'ARIA_ATTEMPT_RESPONSE_MISSING',
      });
    }

    const messages = buildCorrectionPromptMessages({
      activityType: activity.activityType,
      prompt: version.prompt,
      correctionRubric: version.correctionRubric,
      responsePayload: response.payload,
    });
    const feedback = await requestCorrectionFeedback(dependencies.streamModel, messages);

    const committed = await repository.commitCorrectionResult({
      attemptId: input.attemptId,
      outcome: feedback.outcome,
      feedback,
    });

    // Evidence is written only for the write that actually happened — a
    // concurrent request that lost the double-checked-locking race already
    // has its evidence recorded by the request that won.
    if (!committed.wasAlreadyCorrected) {
      await recordLearningEvidence({
        studentId,
        courseKey: activity.courseKey,
        skillId: activity.skillId,
        curriculumVersion: activity.curriculumVersion,
        source: 'PRACTICE_ATTEMPT',
        sourceRefId: input.attemptId,
        outcome: { outcome: feedback.outcome, activityAttemptId: input.attemptId },
        observedAt: new Date(),
      });
    }

    return { result: committed.result, alreadyCorrected: false };
  };
}

/**
 * Fails closed once: a single retry with a stricter re-prompt when the
 * model's first response doesn't parse/validate, never silently accepting
 * malformed output as a real correction. A second failure surfaces as a
 * real, typed error.
 */
async function requestCorrectionFeedback(
  streamModel: CorrectModelDependency,
  messages: readonly ChatMessage[],
) {
  const first = await collectModelText(streamModel(messages));
  try {
    return parseModelCorrectionJson(first);
  } catch (firstError: unknown) {
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant', content: first },
      {
        role: 'user',
        content: 'Ta réponse précédente n’était pas un JSON valide selon le schéma demandé. Réponds à nouveau, EXCLUSIVEMENT avec le JSON attendu, sans aucun texte autour.',
      },
    ];
    const second = await collectModelText(streamModel(retryMessages));
    try {
      return parseModelCorrectionJson(second);
    } catch {
      // The retry's own error is more informative (closer to what a real
      // caller would see last) — surface it, not the first failure.
      throw firstError;
    }
  }
}

export const correctAriaPracticeAttempt = makeCorrectAriaPracticeAttempt({
  repository: prismaActivityRepository,
  streamModel: (messages) => streamChatCompletion(messages),
});
