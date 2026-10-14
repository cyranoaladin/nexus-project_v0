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
import { AriaError, AriaAuthorityUnavailableError } from '../../kernel/errors';
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
  (messages: readonly ChatMessage[], options?: { readonly signal?: AbortSignal }): AsyncIterable<string>;
}

export interface CorrectionScope {
  readonly repository: ActivityRepository;
  readonly authorize: typeof authorizePracticeCorrectionForActor;
  readonly recordEvidence: typeof recordLearningEvidence;
}
export type CorrectionAuthority = <T>(operation: (scope: CorrectionScope) => Promise<T>) => Promise<T>;
type CorrectionResult = { readonly result: ActivityResultRecord; readonly alreadyCorrected: boolean };

/** Poll only while the provider is pending. No authority transaction spans network I/O. */
async function* authorityCheckedModel(
  streamModel: CorrectModelDependency, messages: readonly ChatMessage[], check: () => Promise<void>,
): AsyncIterable<string> {
  await check();
  const controller = new AbortController();
  const iterator = streamModel(messages, { signal: controller.signal })[Symbol.asyncIterator]();
  let stopped = false; let done = false; let lost: unknown;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let checking: Promise<void> | undefined;
  let rejectLoss!: (error: unknown) => void;
  const loss = new Promise<never>((_resolve, reject) => { rejectLoss = reject; });
  void loss.catch(() => undefined);
  const schedule = () => {
    if (stopped || lost) return;
    timer = setTimeout(() => {
      checking = check().catch(error => {
        lost = error; controller.abort(error); rejectLoss(error);
      }).finally(schedule);
    }, 500);
  };
  schedule();
  let failure: unknown;
  try {
    while (!done) {
      await check();
      if (lost) throw lost;
      const next = await Promise.race([iterator.next(), loss]);
      await check();
      if (lost) throw lost;
      done = !!next.done;
      if (!done) yield next.value;
    }
  } catch (error) { failure = lost ?? error; throw failure; }
  finally {
    stopped = true;
    if (timer) clearTimeout(timer);
    await checking;
    controller.abort();
    if (!done && iterator.return) {
      let closeTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([iterator.return(), new Promise<never>((_resolve, reject) => {
          closeTimer = setTimeout(() => reject(new AriaAuthorityUnavailableError()), 1000);
        })]);
      } catch (error) { if (!failure) throw error; }
      finally { if (closeTimer) clearTimeout(closeTimer); }
    }
    if (lost && !failure) throw lost;
  }
}

async function collectModelText(stream: AsyncIterable<string>): Promise<string> {
  let text = '';
  for await (const token of stream) {
    text += token;
  }
  return text;
}

export function makeCorrectAriaPracticeAttempt(dependencies: {
  readonly streamModel: CorrectModelDependency;
  /** Synchronous public projection in the same authority transaction as replay/commit. */
  readonly present?: (value: CorrectionResult) => void;
} & ({ readonly repository: ActivityRepository; readonly withAuthority?: undefined }
  | { readonly withAuthority: CorrectionAuthority; readonly repository?: undefined })) {
  return async function correctAriaPracticeAttempt(
    input: AriaPracticeCorrectInput,
  ): Promise<CorrectionResult> {
    const actor = Object.freeze({ ...resolveInteractiveStudentActor(input.actor) });
    const attemptId = input.attemptId;
    const withAuthority: CorrectionAuthority = dependencies.withAuthority ?? (operation => operation({
      repository: dependencies.repository!, authorize: authorizePracticeCorrectionForActor, recordEvidence: recordLearningEvidence,
    }));
    const prepared = await withAuthority(async ({ repository, authorize }) => {
    const studentId = await repository.resolveStudentIdByUserId(actor.userId);
    if (!studentId) {
      throw new AriaError('NOT_ENROLLED', 403, 'Profil élève introuvable.');
    }

    const attempt = await repository.getAttemptById(attemptId);
    // Same shape whether the attempt doesn't exist or belongs to someone
    // else — never reveal which, to a requester who isn't the owner.
    if (!attempt || attempt.studentId !== studentId) {
      throw new AriaError('BAD_REQUEST', 404, 'Tentative introuvable.');
    }

    // Dual gate re-checked at correction time (not just at attempt-start):
    // course access + the CURRENT `practiceCorrection` tier capability —
    // correction triggers a new, real model call, unlike submission.
    await authorize({
      actor,
      courseKey: attempt.courseKey,
    });

    const begin = await repository.beginCorrection(attemptId);
    if (begin.alreadyCorrected) {
      dependencies.present?.({ result: begin.result, alreadyCorrected: true });
      return { kind: 'REPLAY' as const, result: begin.result };
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
    const response = await repository.getResponseByAttemptId(attemptId);
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
    return { kind: 'MODEL' as const, studentId, attempt, activity, messages };
    });
    if (prepared.kind === 'REPLAY') return { result: prepared.result, alreadyCorrected: true };

    const assertCurrent = async (scope: CorrectionScope) => {
      const studentId = await scope.repository.resolveStudentIdByUserId(actor.userId);
      const current = await scope.repository.getAttemptById(attemptId);
      if (studentId !== prepared.studentId || !current || current.studentId !== studentId
        || current.activityId !== prepared.attempt.activityId || current.activityVersionId !== prepared.attempt.activityVersionId
        || current.courseKey !== prepared.attempt.courseKey) {
        throw new AriaError('BAD_REQUEST', 404, 'Tentative introuvable.');
      }
      await scope.authorize({ actor, courseKey: current.courseKey });
    };
    const check = () => withAuthority(assertCurrent);
    const feedback = await requestCorrectionFeedback(
      messages => authorityCheckedModel(dependencies.streamModel, messages, check), prepared.messages,
    );

    return await withAuthority(async scope => {
    await assertCurrent(scope);
    const committed = await scope.repository.commitCorrectionResult({
      attemptId,
      outcome: feedback.outcome,
      feedback,
    });

    // Evidence is written only for the write that actually happened — a
    // concurrent request that lost the double-checked-locking race already
    // has its evidence recorded by the request that won.
    if (!committed.wasAlreadyCorrected) {
      await scope.recordEvidence({
        studentId: prepared.studentId,
        courseKey: prepared.activity.courseKey,
        skillId: prepared.activity.skillId,
        curriculumVersion: prepared.activity.curriculumVersion,
        source: 'PRACTICE_ATTEMPT',
        sourceRefId: attemptId,
        outcome: { outcome: feedback.outcome, activityAttemptId: attemptId },
        observedAt: new Date(),
      });
    }

    await assertCurrent(scope);
    const result = { result: committed.result, alreadyCorrected: committed.wasAlreadyCorrected };
    dependencies.present?.(result);
    return result;
    });
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
  streamModel: (messages, options) => streamChatCompletion(messages, options),
});
