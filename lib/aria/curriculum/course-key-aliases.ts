/**
 * Bridges ARIA's two real, independent course-key namespaces (discovered
 * via P6c's golden E2E — the real cockpit UI passes the FIRST of these,
 * the real Practice/Correction/Mastery/Next-Best-Action backend has always
 * validated the SECOND, and nothing bridged them until now):
 *
 *  1. The cockpit's own product catalog key (`lib/aria/curriculum/catalog.ts`,
 *     P0) — e.g. `maths-premiere-eds` — what `AriaCourseCard.course.key`
 *     actually is, and what the real cockpit UI passes as `courseKey` to
 *     every route it calls (mastery, next-best-action, practice/*).
 *  2. The canonical curriculum enrollment key
 *     (`@/lib/curriculum/catalog`) — e.g. `eds-maths-premiere` — also used
 *     by the skill-graph registry for compiled courses, and therefore what
 *     `authorizePracticeCourseForActor`/
 *     `authorizePracticeCorrectionForActor` have validated against since
 *     P2a, matching the chat conversation pipeline's own
 *     `build-context.ts`.
 *
 * This module is the single explicit bridge for both skill-graph lookup and
 * checks against `StudentCourseEnrollment`; callers must never recreate these
 * cross-namespace identities by naming convention.
 */

const COCKPIT_TO_CANONICAL_COURSE_KEY: Readonly<Record<string, string>> = Object.freeze({
  'maths-premiere-eds': 'eds-maths-premiere',
  'maths-terminale-eds': 'eds-maths-terminale',
  'nsi-premiere-eds': 'eds-nsi-premiere',
  'nsi-terminale-eds': 'eds-nsi-terminale',
  'physique-chimie-premiere-eds': 'eds-physique-chimie-premiere',
  'physique-chimie-terminale-eds': 'eds-physique-chimie-terminale',
  'svt-premiere-eds': 'eds-svt-premiere',
  'svt-terminale-eds': 'eds-svt-terminale',
  'ses-premiere-eds': 'eds-ses-premiere',
  'ses-terminale-eds': 'eds-ses-terminale',
  'maths-expertes-terminale': 'opt-maths-expertes-terminale',
  'maths-complementaires-terminale': 'opt-maths-complementaires-terminale',
  'maths-premiere-stmg': 'stmg-maths-premiere',
  'sgn-premiere-stmg': 'stmg-sgn-premiere',
  'management-premiere-stmg': 'stmg-management-premiere',
  'droit-eco-premiere-stmg': 'stmg-droit-eco-premiere',
});

/**
 * Returns the canonical curriculum/skill-graph key for a real cockpit course
 * key, or the input unchanged when it is already canonical or unknown. The
 * caller's canonical-catalog lookup remains responsible for unknown rejection.
 */
export function toCanonicalAriaCourseKey(courseKey: string): string {
  return COCKPIT_TO_CANONICAL_COURSE_KEY[courseKey] ?? courseKey;
}
