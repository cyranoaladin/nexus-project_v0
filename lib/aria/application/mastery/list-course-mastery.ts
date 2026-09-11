/**
 * Course-wide Mastery projection (P5): every skill in a course's real skill
 * graph, each with its computed Mastery level (P3) and — when one exists —
 * the id of an authored Activity a student could practice for it.
 *
 * This is the shared batch-read this module, `get-mastery.ts` (single
 * skill), and `get-next-best-action.ts` (P4a) all build on: one
 * LearningEvidence read for the whole course, not one query per skill.
 * `get-next-best-action.ts` is written in terms of this list precisely so
 * the two never compute mastery two different ways.
 */
import { getSkillGraph } from '../../curriculum/skill-graph';
import type { PracticeAttemptOutcome } from '../../domain/evidence/outcome';
import { computeMastery, type MasteryEvidencePoint, type MasteryLevel } from '../../domain/mastery/mastery-level';
import { prismaActivityRepository } from '../../infrastructure/prisma/activity-repository';
import { authorizePracticeCourseForActor, type AriaPracticeActorInput } from '../practice/authorize';
import { listLearningEvidenceForStudent } from '../evidence/list';

// One batched evidence read for the whole course rather than one query per
// skill — generous enough to cover every skill's recent history at once.
const COURSE_MASTERY_EVIDENCE_LIMIT = 200;

export interface AriaCourseSkillMastery {
  readonly skillId: string;
  readonly skillLabel: string;
  readonly level: MasteryLevel;
  /** `null` when no Activity has been authored for this skill yet — nothing to practice. */
  readonly activityId: string | null;
}

export async function listAriaCourseMasteryForActor(
  input: AriaPracticeActorInput & { readonly courseKey: string },
): Promise<readonly AriaCourseSkillMastery[]> {
  await authorizePracticeCourseForActor(input);

  const graph = getSkillGraph(input.courseKey);
  if (!graph) return [];

  const activities = await prismaActivityRepository.listActivitiesForCourse(input.courseKey);
  const firstActivityBySkillId = new Map<string, string>();
  for (const activity of activities) {
    if (!activity.skillId || activity.activeVersion === null) continue;
    if (!firstActivityBySkillId.has(activity.skillId)) {
      firstActivityBySkillId.set(activity.skillId, activity.id);
    }
  }

  const evidence = await listLearningEvidenceForStudent({
    actor: input.actor,
    filters: { courseKey: input.courseKey, source: 'PRACTICE_ATTEMPT', limit: COURSE_MASTERY_EVIDENCE_LIMIT },
  });
  const evidenceBySkillId = new Map<string, MasteryEvidencePoint[]>();
  for (const row of evidence) {
    if (!row.skillId) continue;
    const points = evidenceBySkillId.get(row.skillId) ?? [];
    // Safe to narrow: filtered to `source: 'PRACTICE_ATTEMPT'` above, which
    // guarantees this shape (see get-mastery.ts's identical reasoning).
    points.push({ outcome: (row.outcome as PracticeAttemptOutcome).outcome, observedAt: row.observedAt });
    evidenceBySkillId.set(row.skillId, points);
  }

  const result: AriaCourseSkillMastery[] = [];
  for (const domain of graph.domains) {
    for (const competency of domain.competencies) {
      result.push({
        skillId: competency.rawSkillId,
        skillLabel: competency.label,
        level: computeMastery(evidenceBySkillId.get(competency.rawSkillId) ?? []),
        activityId: firstActivityBySkillId.get(competency.rawSkillId) ?? null,
      });
    }
  }
  return Object.freeze(result);
}
