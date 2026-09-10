/**
 * Deliberately does NOT re-run `authorizePracticeCourseForActor` (course
 * access / tier-capability gate): submission only verifies ownership of an
 * already-legitimately-started attempt, it does not grant a new capability.
 * An entitlement lapsing mid-attempt must not discard a student's
 * already-in-progress work — the gate that matters (course access + tier
 * `practice` capability) was already enforced at start time. IDOR
 * prevention (ownership) is still mandatory and real here.
 */
import { getActivityById } from './shared';
import { parseActivityResponsePayload, type ActivityType } from '../../domain/practice/activity-content';
import { AriaError } from '../../errors';
import { resolveInteractiveStudentActor } from '../../kernel/actor-subject';
import { prismaActivityRepository } from '../../infrastructure/prisma/activity-repository';
import type { ActivityAttemptRecord, ActivityRepository, ActivityResponseRecord } from './ports';

export interface AriaPracticeSubmitInput {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly attemptId: string;
  readonly payload: unknown;
}

export function makeSubmitAriaPracticeAttempt(repository: ActivityRepository) {
  return async function submitAriaPracticeAttempt(
    input: AriaPracticeSubmitInput,
  ): Promise<{ readonly attempt: ActivityAttemptRecord; readonly response: ActivityResponseRecord }> {
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

    const activity = await getActivityById(repository, attempt.activityId);
    const validatedPayload = parseActivityResponsePayload(
      activity.activityType as ActivityType,
      input.payload,
    );

    return repository.submitAttempt({ attemptId: input.attemptId, payload: validatedPayload });
  };
}

export const submitAriaPracticeAttempt = makeSubmitAriaPracticeAttempt(prismaActivityRepository);
