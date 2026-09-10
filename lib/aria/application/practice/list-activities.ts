import { authorizePracticeCourseForActor, type AriaPracticeActorInput } from './authorize';
import { prismaActivityRepository } from '../../infrastructure/prisma/activity-repository';
import type { ActivityRepository } from './ports';

export interface AriaPracticeActivitySummary {
  readonly activityId: string;
  readonly courseKey: string;
  readonly skillId: string | null;
  readonly activityType: string;
  readonly activityVersionId: string;
  readonly prompt: unknown;
  readonly expectedAnswerShape: unknown;
}

export function makeListAriaPracticeActivitiesForActor(repository: ActivityRepository) {
  return async function listAriaPracticeActivitiesForActor(
    input: AriaPracticeActorInput & { readonly courseKey: string },
  ): Promise<readonly AriaPracticeActivitySummary[]> {
    await authorizePracticeCourseForActor(input);
    const activities = await repository.listActivitiesForCourse(input.courseKey);
    return Object.freeze(
      activities
        .filter((activity) => activity.activeVersion !== null)
        .map((activity) => {
          const version = activity.activeVersion!;
          return Object.freeze({
            activityId: activity.id,
            courseKey: activity.courseKey,
            skillId: activity.skillId,
            activityType: activity.activityType,
            activityVersionId: version.id,
            prompt: version.prompt,
            expectedAnswerShape: version.expectedAnswerShape,
            // correctionRubric deliberately never included here.
          });
        }),
    );
  };
}

export const listAriaPracticeActivitiesForActor = makeListAriaPracticeActivitiesForActor(prismaActivityRepository);
