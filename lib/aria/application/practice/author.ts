/**
 * Internal authoring path for Activity/ActivityVersion — NEVER reachable
 * from an HTTP handler, same principle as
 * `application/evidence/record.ts`'s write path: a client-writable "author
 * your own practice content" endpoint would let a student invent their own
 * questions/answer keys. Real content authoring (an admin tool, a CLI, a
 * future curated-content pipeline) calls this directly; it is not a public
 * route in this lot.
 */
import { getCourse } from '@/lib/curriculum/catalog';
import { getSkill } from '../../curriculum/skill-graph';
import { parseActivityContent, type ActivityType } from '../../domain/practice/activity-content';
import { AriaError } from '../../errors';
import { prismaActivityRepository } from '../../infrastructure/prisma/activity-repository';
import type { ActivityRecord, ActivityRepository } from './ports';

export interface AuthorAriaActivityInput {
  readonly courseKey: string;
  readonly skillId: string | null;
  readonly curriculumVersion: string;
  readonly activityType: ActivityType;
  readonly versionLabel: string;
  readonly prompt: unknown;
  readonly expectedAnswerShape: unknown;
  readonly correctionRubric: unknown;
}

export function makeAuthorAriaActivity(repository: ActivityRepository) {
  return async function authorAriaActivity(input: AuthorAriaActivityInput): Promise<ActivityRecord> {
    if (!getCourse(input.courseKey)) {
      throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
    }
    if (input.skillId !== null && !getSkill(input.courseKey, input.skillId)) {
      throw new AriaError('SKILL_MISMATCH', 400, 'La compétence ne correspond pas au cours demandé.');
    }
    const content = parseActivityContent(input.activityType, {
      prompt: input.prompt,
      expectedAnswerShape: input.expectedAnswerShape,
      correctionRubric: input.correctionRubric,
    });
    return repository.createActivityWithVersion({
      courseKey: input.courseKey,
      skillId: input.skillId,
      curriculumVersion: input.curriculumVersion,
      activityType: input.activityType,
      versionLabel: input.versionLabel,
      prompt: content.prompt,
      expectedAnswerShape: content.expectedAnswerShape,
      correctionRubric: content.correctionRubric,
    });
  };
}

export const authorAriaActivity = makeAuthorAriaActivity(prismaActivityRepository);
