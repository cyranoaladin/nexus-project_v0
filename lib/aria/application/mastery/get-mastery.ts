/**
 * Mastery read path (P3): computed on the fly from LearningEvidence (P1),
 * no persisted snapshot. Same course-access gate as Practice
 * (`authorizePracticeCourseForActor`) — mastery reflects practice evidence,
 * so it requires the same access as practice itself, not a separate
 * capability.
 *
 * Scoped to PRACTICE_ATTEMPT evidence — the only real graded evidence
 * producer today (P2b). A later lot adding a second graded producer (e.g.
 * a coach's CORRECTION_RESULT) should feed it into this same
 * `computeMastery` call, not create a parallel mastery path.
 */
import { getSkill } from '../../curriculum/skill-graph';
import type { PracticeAttemptOutcome } from '../../domain/evidence/outcome';
import { computeMastery, type MasteryEvidencePoint, type MasteryLevel } from '../../domain/mastery/mastery-level';
import { AriaError } from '../../kernel/errors';
import { authorizePracticeCourseForActor, type AriaPracticeActorInput } from '../practice/authorize';
import { listLearningEvidenceForStudent } from '../evidence/list';

// Enough recent history for a streak read without an unbounded scan — the
// streak algorithm itself never looks past MASTERED_STREAK (3) consecutive
// CORRECT results.
const MASTERY_EVIDENCE_LIMIT = 10;

export interface AriaSkillMastery {
  readonly courseKey: string;
  readonly skillId: string;
  readonly level: MasteryLevel;
  readonly attemptsConsidered: number;
}

export async function getAriaSkillMasteryForActor(
  input: AriaPracticeActorInput & { readonly courseKey: string; readonly skillId: string },
): Promise<AriaSkillMastery> {
  await authorizePracticeCourseForActor(input);

  if (!getSkill(input.courseKey, input.skillId)) {
    throw new AriaError('SKILL_MISMATCH', 400, 'La compétence ne correspond pas au cours demandé.');
  }

  const evidence = await listLearningEvidenceForStudent({
    actor: input.actor,
    filters: {
      courseKey: input.courseKey,
      skillId: input.skillId,
      source: 'PRACTICE_ATTEMPT',
      limit: MASTERY_EVIDENCE_LIMIT,
    },
  });

  // The `source: 'PRACTICE_ATTEMPT'` filter above guarantees every row's
  // outcome was already validated against `practiceOutcomeSchema` at read
  // time (`learning-evidence-repository.ts`'s own `parseLearningEvidenceOutcome`
  // call) — safe to narrow here, not an unchecked cast.
  const points: MasteryEvidencePoint[] = evidence.map((row) => ({
    outcome: (row.outcome as PracticeAttemptOutcome).outcome,
    observedAt: row.observedAt,
  }));

  return Object.freeze({
    courseKey: input.courseKey,
    skillId: input.skillId,
    level: computeMastery(points),
    attemptsConsidered: points.length,
  });
}
