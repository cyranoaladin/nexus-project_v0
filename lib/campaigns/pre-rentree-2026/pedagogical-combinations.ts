import type { EntryLevelCode } from './schema';
import { enumerateSelections } from './itinerary';

/**
 * A real French Terminale/Première student takes a fixed, small number of
 * specialties — a stage subject selection that implies more specialties than
 * that is not a combination any real family can order, and must never be
 * enumerated, tested or offered by the configurator (owner decision,
 * addendum Section E — supersedes the earlier brute-force "1 to 4 of
 * anything" enumeration, which produced pedagogically impossible baskets).
 *
 * MATHS_EXPERTES and (once introduced) PHILOSOPHIE are never counted as
 * specialties: Maths expertes is an option layered on top of the
 * Mathématiques specialty (R5), and Philosophie is compulsory common core in
 * Terminale, orthogonal to specialty choice.
 */
const TERMINALE_SPECIALTIES = ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'SVT'] as const;
const MAXIMUM_TERMINALE_SPECIALTIES = 2;

const PREMIERE_SPECIALTIES = ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'SVT'] as const;
const MAXIMUM_PREMIERE_SPECIALTIES = 3;

/** Subjects that are never counted against the level's specialty cap. */
const NON_SPECIALTY_SUBJECTS_BY_LEVEL: Partial<Record<EntryLevelCode, readonly string[]>> = {
  TERMINALE: ['MATHS_EXPERTES'],
  PREMIERE: ['FRANCAIS'],
};

/** R5: Mathématiques expertes is only ever offered alongside Mathématiques. */
export function requiresMathematiquesForExpertes(subjectIds: readonly string[]): boolean {
  if (!subjectIds.includes('MATHS_EXPERTES')) return true;
  return subjectIds.includes('MATHEMATIQUES');
}

/**
 * Whether a subject selection at `level` describes a combination a real
 * family could actually order (Section E). Fondations levels (3e, Seconde,
 * and — once introduced — 4e) have no specialty system, so every non-empty
 * subset of the level's subjects is valid.
 */
export function isPedagogicallyValidSelection(level: EntryLevelCode, subjectIds: readonly string[]): boolean {
  if (new Set(subjectIds).size !== subjectIds.length) return false;
  if (!requiresMathematiquesForExpertes(subjectIds)) return false;

  if (level === 'TERMINALE') {
    const specialtyCount = subjectIds.filter((id) => (TERMINALE_SPECIALTIES as readonly string[]).includes(id)).length;
    return specialtyCount <= MAXIMUM_TERMINALE_SPECIALTIES;
  }
  if (level === 'PREMIERE') {
    const specialtyCount = subjectIds.filter((id) => (PREMIERE_SPECIALTIES as readonly string[]).includes(id)).length;
    return specialtyCount <= MAXIMUM_PREMIERE_SPECIALTIES;
  }
  // Fondations (TROISIEME, SECONDE, and 4e once introduced): no specialty cap.
  return true;
}

/**
 * Every pedagogically valid, non-empty subject selection at `level`, up to
 * `maxTotal` subjects (the commercial pack cap) — never the raw powerset.
 */
export function enumeratePedagogicalSelections(
  level: EntryLevelCode,
  availableSubjectIds: readonly string[],
  maxTotal: number,
): string[][] {
  return enumerateSelections(availableSubjectIds, maxTotal)
    .filter((selection) => isPedagogicallyValidSelection(level, selection));
}

export { NON_SPECIALTY_SUBJECTS_BY_LEVEL };
