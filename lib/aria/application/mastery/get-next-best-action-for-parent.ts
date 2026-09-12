/**
 * Next Best Action, parent read path (P7a) — mirrors
 * `get-next-best-action.ts` (P4a) exactly, built on
 * `listAriaCourseMasteryForParent` (P6a) instead of the self-service
 * `listAriaCourseMasteryForActor`, so a parent and their child can never
 * disagree about which skill ARIA would recommend next: the same pure
 * `pickNextBestSkill` decision, over the same real Mastery projection.
 */
import { pickNextBestSkill, type SkillMasterySummary } from '../../domain/mastery/next-best-skill';
import { listAriaCourseMasteryForParent } from './list-course-mastery-for-parent';
import type { AriaNextBestAction } from './get-next-best-action';
import type { AriaParentCourseActorInput } from '../parent/authorize-course-for-parent';

export async function getAriaNextBestActionForParent(
  input: AriaParentCourseActorInput,
): Promise<AriaNextBestAction | null> {
  const skills = await listAriaCourseMasteryForParent(input);
  const activityIdBySkillId = new Map<string, string>();
  const candidates: SkillMasterySummary[] = [];
  for (const skill of skills) {
    if (skill.activityId === null) continue;
    activityIdBySkillId.set(skill.skillId, skill.activityId);
    candidates.push({ skillId: skill.skillId, label: skill.skillLabel, level: skill.level });
  }

  const chosen = pickNextBestSkill(candidates);
  if (!chosen) return null;

  return Object.freeze({
    courseKey: input.courseKey,
    skillId: chosen.skillId,
    skillLabel: chosen.label,
    level: chosen.level,
    activityId: activityIdBySkillId.get(chosen.skillId)!,
  });
}
