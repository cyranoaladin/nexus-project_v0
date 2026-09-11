/**
 * Next Best Action (P4a): pure, no I/O. Picks a single skill worth
 * practicing next, from a student's already-computed Mastery level per
 * skill (P3) — the caller has already restricted candidates to skills that
 * actually have an authored Activity (recommending a skill with nothing to
 * practice would be a dead end).
 *
 * Priority: DEVELOPING (the most urgent gap) > PROFICIENT (keep momentum
 * toward mastery) > NOT_STARTED (new territory, once nothing already in
 * progress needs reinforcement) — MASTERED is excluded entirely, nothing
 * to do there. This is a simple, swappable heuristic, not a locked-in
 * algorithm: it lives in one small pure function specifically so a future
 * lot can change the ordering without touching persistence or the read
 * path around it.
 */
import type { MasteryLevel } from './mastery-level';

export interface SkillMasterySummary {
  readonly skillId: string;
  readonly label: string;
  readonly level: MasteryLevel;
}

const PRIORITY_ORDER: readonly MasteryLevel[] = ['DEVELOPING', 'PROFICIENT', 'NOT_STARTED'];

/** `candidates` order is preserved as the tie-breaker within a tier. */
export function pickNextBestSkill(
  candidates: readonly SkillMasterySummary[],
): SkillMasterySummary | null {
  for (const level of PRIORITY_ORDER) {
    const match = candidates.find((candidate) => candidate.level === level);
    if (match) return match;
  }
  return null;
}
