/**
 * Parent read path (P6a): a parent may view their own linked child's
 * Mastery, course by course — exactly the same real data the student
 * themselves would see via `list-course-mastery.ts`, never more, never
 * from a different family.
 *
 * Deliberately its own authorization path, not a widening of the
 * self-service one: `evidence/list.ts`'s own docstring flagged parent
 * access as explicit future scope requiring its own path. This module
 * never calls `authorizePracticeCourseForActor` (ELEVE-only, self-service)
 * — it resolves the child's real Student row directly (scoped to the
 * requesting parent's own `ParentProfile.children`) and re-derives course
 * access from the CHILD's own data (`resolveAriaCourseAccess`,
 * `buildCanonicalAriaEntitlementContext` — both pure, actor-agnostic
 * functions already used by the self-service path).
 */
import { getCourse, isKnownCourseKey } from '@/lib/curriculum/catalog';
import { resolveAriaCourseAccess } from '../../access';
import { getSkillGraph } from '../../curriculum/skill-graph';
import type { PracticeAttemptOutcome } from '../../domain/evidence/outcome';
import { computeMastery, type MasteryEvidencePoint } from '../../domain/mastery/mastery-level';
import { prismaActivityRepository } from '../../infrastructure/prisma/activity-repository';
import { prismaLearningEvidenceRepository } from '../../infrastructure/prisma/learning-evidence-repository';
import { buildCanonicalAriaEntitlementContext } from '../../kernel/entitlements';
import { AriaError } from '../../kernel/errors';
import { resolveInteractiveParentActor } from '../../kernel/parent-subject';
import { loadChildForParent } from '../parent/load-child-for-parent';
import type { AriaCourseSkillMastery } from './list-course-mastery';

// Same batching rationale as list-course-mastery.ts: one evidence read for
// the whole course, not one query per skill.
const COURSE_MASTERY_EVIDENCE_LIMIT = 200;

export async function listAriaCourseMasteryForParent(input: {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly studentId: string;
  readonly courseKey: string;
}): Promise<readonly AriaCourseSkillMastery[]> {
  const actor = resolveInteractiveParentActor(input.actor);

  if (!isKnownCourseKey(input.courseKey) || !getCourse(input.courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }

  const student = await loadChildForParent(actor.userId, input.studentId);

  const entitlements = buildCanonicalAriaEntitlementContext(student.user.entitlements, new Date());
  const access = resolveAriaCourseAccess({ courseKey: input.courseKey, student, entitlements });
  if (!access.academicallyRelevant) {
    throw new AriaError('NOT_ENROLLED', 403, 'Ce cours ne fait pas partie du cursus scolaire actif de cet élève.');
  }
  if (!access.commerciallyEntitled) {
    throw new AriaError('NOT_ENTITLED', 403, 'Aucun droit ARIA actif ne couvre ce cours pour cet élève.');
  }

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

  const evidence = await prismaLearningEvidenceRepository.listForStudent(student.id, {
    courseKey: input.courseKey,
    source: 'PRACTICE_ATTEMPT',
    limit: COURSE_MASTERY_EVIDENCE_LIMIT,
  });
  const evidenceBySkillId = new Map<string, MasteryEvidencePoint[]>();
  for (const row of evidence) {
    if (!row.skillId) continue;
    const points = evidenceBySkillId.get(row.skillId) ?? [];
    // Safe to narrow: filtered to `source: 'PRACTICE_ATTEMPT'` above, same
    // reasoning as list-course-mastery.ts's identical narrowing.
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
