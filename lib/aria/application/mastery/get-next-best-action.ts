/**
 * Next Best Action (P4a): reuses Practice's own course-access gate
 * (`authorizePracticeCourseForActor`) — recommending what to practice next
 * requires exactly the same access as practice itself. No new persisted
 * state: candidate skills come from the real skill graph crossed with real
 * authored Activities, mastery per skill is P3's own `computeMastery` fed
 * from a single batched LearningEvidence read (not one query per skill).
 *
 * `null` is a real, valid result — not an error: it means either the
 * course has no authored practice content yet, or the student has already
 * mastered every skill that does have content.
 */
import { getSkillGraph } from '../../curriculum/skill-graph';
import type { PracticeAttemptOutcome } from '../../domain/evidence/outcome';
import { computeMastery, type MasteryEvidencePoint } from '../../domain/mastery/mastery-level';
import { pickNextBestSkill, type SkillMasterySummary } from '../../domain/mastery/next-best-skill';
import { prismaActivityRepository } from '../../infrastructure/prisma/activity-repository';
import { authorizePracticeCourseForActor, type AriaPracticeActorInput } from '../practice/authorize';
import { listLearningEvidenceForStudent } from '../evidence/list';

// One batched evidence read for the whole course rather than one query per
// skill — generous enough to cover every skill's recent history at once.
const NBA_EVIDENCE_LIMIT = 200;

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
  await authorizePracticeCourseForActor(input);

  const graph = getSkillGraph(input.courseKey);
  if (!graph) return null;

  const activities = await prismaActivityRepository.listActivitiesForCourse(input.courseKey);
  const firstActivityBySkillId = new Map<string, string>();
  for (const activity of activities) {
    if (!activity.skillId || activity.activeVersion === null) continue;
    if (!firstActivityBySkillId.has(activity.skillId)) {
      firstActivityBySkillId.set(activity.skillId, activity.id);
    }
  }
  if (firstActivityBySkillId.size === 0) return null;

  const evidence = await listLearningEvidenceForStudent({
    actor: input.actor,
    filters: { courseKey: input.courseKey, source: 'PRACTICE_ATTEMPT', limit: NBA_EVIDENCE_LIMIT },
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

  const candidates: SkillMasterySummary[] = [];
  for (const domain of graph.domains) {
    for (const competency of domain.competencies) {
      if (!firstActivityBySkillId.has(competency.rawSkillId)) continue;
      candidates.push({
        skillId: competency.rawSkillId,
        label: competency.label,
        level: computeMastery(evidenceBySkillId.get(competency.rawSkillId) ?? []),
      });
    }
  }

  const chosen = pickNextBestSkill(candidates);
  if (!chosen) return null;

  return Object.freeze({
    courseKey: input.courseKey,
    skillId: chosen.skillId,
    skillLabel: chosen.label,
    level: chosen.level,
    activityId: firstActivityBySkillId.get(chosen.skillId)!,
  });
}
