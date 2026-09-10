/**
 * Mastery projection (P3): pure, no I/O, no persisted state. Mastery is
 * always computed fresh from LearningEvidence (P1) — never a snapshot that
 * could drift out of sync with the append-only ledger it derives from.
 *
 * Recency-weighted streak, not a cumulative score: the level reflects the
 * student's CURRENT command of a skill, so a recent slip resets to
 * DEVELOPING even after an older correct run — forgiving of the past,
 * honest about today. PARTIALLY_CORRECT breaks the streak exactly like
 * INCORRECT; only a fully CORRECT attempt advances it.
 */

export type MasteryLevel = 'NOT_STARTED' | 'DEVELOPING' | 'PROFICIENT' | 'MASTERED';

export interface MasteryEvidencePoint {
  readonly outcome: 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT';
  readonly observedAt: Date;
}

const PROFICIENT_STREAK = 2;
const MASTERED_STREAK = 3;

/**
 * Order-independent: sorts by `observedAt` descending internally, so a
 * caller can never silently invert the result by passing evidence in the
 * wrong order.
 */
export function computeMastery(evidence: readonly MasteryEvidencePoint[]): MasteryLevel {
  if (evidence.length === 0) {
    return 'NOT_STARTED';
  }

  const newestFirst = [...evidence].sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());

  let streak = 0;
  for (const point of newestFirst) {
    if (point.outcome !== 'CORRECT') break;
    streak += 1;
  }

  if (streak >= MASTERED_STREAK) return 'MASTERED';
  if (streak >= PROFICIENT_STREAK) return 'PROFICIENT';
  return 'DEVELOPING';
}
