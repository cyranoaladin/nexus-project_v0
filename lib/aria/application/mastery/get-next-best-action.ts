/**
 * Next Best Action (P4a): picks a single skill worth practicing next, from
 * `listAriaCourseMasteryForActor`'s (P5) course-wide Mastery projection —
 * both read paths share the exact same evidence-batching and mastery
 * computation, so they can never disagree about what a student's mastery
 * actually is.
 *
 * `null` is a real, valid result — not an error: it means either the
 * course has no authored practice content yet, or the student has already
 * mastered every skill that does have content.
 */
import { pickNextBestSkill, type SkillMasterySummary } from '../../domain/mastery/next-best-skill';
import { listAriaCourseMasteryForActor } from './list-course-mastery';
import type { AriaPracticeActorInput } from '../practice/authorize';

export interface AriaNextBestAction {
  readonly courseKey: string;
  readonly skillId: string;
  readonly skillLabel: string;
  readonly level: SkillMasterySummary['level'];
  readonly activityId: string;
}

export async function getAriaNextBestActionForActor(
  input: AriaPracticeActorInput & { readonly courseKey: string },
): Promise<AriaNextBestAction | null> {
  const skills = await listAriaCourseMasteryForActor(input);
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
