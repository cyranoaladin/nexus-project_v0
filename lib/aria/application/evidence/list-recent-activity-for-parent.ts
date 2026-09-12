/**
 * Recent practice activity, parent read path (P7a) — the real, per-skill
 * outcome/timestamp trail behind a child's Mastery, never the private
 * chat: this reads `LearningEvidence` (PRACTICE_ATTEMPT source only),
 * the same append-only, chat-free evidence store every other real Mastery
 * projection in this codebase is built on
 * (`aria-learning-evidence-append-only` architecture boundary). A parent
 * report showing "what was practiced and how it went" must never become a
 * door into `AriaMessage`/`AriaConversation` — this module doesn't import
 * either, and never will.
 */
import { getSkillGraph } from '../../curriculum/skill-graph';
import type { PracticeAttemptOutcome } from '../../domain/evidence/outcome';
import { prismaLearningEvidenceRepository } from '../../infrastructure/prisma/learning-evidence-repository';
import { AriaError } from '../../kernel/errors';
import { authorizeCourseAccessForParent, type AriaParentCourseActorInput } from '../parent/authorize-course-for-parent';

// A short recent feed, not a full history — the parent report's "what
// happened lately" section, same order of magnitude as the cockpit's own
// streak read (mastery-level.ts's MASTERED_STREAK never looks past 3).
const RECENT_ACTIVITY_LIMIT = 10;

export interface AriaRecentActivityItem {
  readonly skillId: string;
  readonly skillLabel: string;
  readonly outcome: PracticeAttemptOutcome['outcome'];
  readonly observedAt: Date;
}

export async function listAriaRecentActivityForParent(
  input: AriaParentCourseActorInput,
): Promise<readonly AriaRecentActivityItem[]> {
  let authorized: Awaited<ReturnType<typeof authorizeCourseAccessForParent>>;
  try {
    authorized = await authorizeCourseAccessForParent(input);
  } catch (error) {
    // A real, entitled child whose tier simply doesn't include parent
    // reporting gets a real empty feed here, not a thrown error — this
    // card mounts unconditionally, and AUTONOMIE is the common case.
    if (error instanceof AriaError && error.code === 'NOT_ENTITLED') return Object.freeze([]);
    throw error;
  }
  const { student, courseKey } = authorized;

  const graph = getSkillGraph(courseKey);
  if (!graph) return [];
  const skillLabelById = new Map<string, string>();
  for (const domain of graph.domains) {
    for (const competency of domain.competencies) {
      skillLabelById.set(competency.rawSkillId, competency.label);
    }
  }

  const evidence = await prismaLearningEvidenceRepository.listForStudent(student.id, {
    courseKey,
    source: 'PRACTICE_ATTEMPT',
    limit: RECENT_ACTIVITY_LIMIT,
  });

  return Object.freeze(
    evidence
      .filter((row): row is typeof row & { skillId: string } => row.skillId !== null)
      .map((row) => ({
        skillId: row.skillId,
        skillLabel: skillLabelById.get(row.skillId) ?? row.skillId,
        // Safe to narrow: filtered to `source: 'PRACTICE_ATTEMPT'` above,
        // same reasoning as list-course-mastery.ts's identical narrowing.
        outcome: (row.outcome as PracticeAttemptOutcome).outcome,
        observedAt: row.observedAt,
      })),
  );
}
