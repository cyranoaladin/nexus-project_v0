import { authorizePracticeCourseForActor, type AriaPracticeActorInput } from './authorize';
import { getActivityById } from './shared';
import { prismaActivityRepository } from '../../infrastructure/prisma/activity-repository';
import type { ActivityAttemptRecord, ActivityRepository } from './ports';

export function makeStartAriaPracticeAttempt(repository: ActivityRepository) {
  return async function startAriaPracticeAttempt(
    input: AriaPracticeActorInput & { readonly activityId: string },
  ): Promise<ActivityAttemptRecord> {
    const activity = await getActivityById(repository, input.activityId);
    const { student } = await authorizePracticeCourseForActor({
      actor: input.actor,
      now: input.now,
      courseKey: activity.courseKey,
    });
    return repository.startOrResumeAttempt({
      studentId: student.id,
      activityId: activity.id,
      activityVersionId: activity.activeVersion.id,
      courseKey: activity.courseKey,
    });
  };
}

export const startAriaPracticeAttempt = makeStartAriaPracticeAttempt(prismaActivityRepository);
