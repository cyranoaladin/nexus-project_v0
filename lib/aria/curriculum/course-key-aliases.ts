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
 *  2. The canonical skill-graph registry key
 *     (`lib/aria/curriculum/skill-graph.ts`) — e.g. `eds-maths-premiere` —
 *     what the general Nexus curriculum catalog (`@/lib/curriculum/catalog`)
 *     uses, and so what `authorizePracticeCourseForActor`/
 *     `authorizePracticeCorrectionForActor` have validated against since
 *     P2a, matching the chat conversation pipeline's own
 *     `build-context.ts`.
 *
 * `lib/aria/cockpit/skill-views.ts` already discovered and bridged this
 * exact mismatch for its own narrower purpose (skill-graph rendering,
 * `COURSE_KEY_TO_CANONICAL_REGISTRY_KEY` there) — this is the same real
 * bijection. Deliberately a separate copy here rather than an import: that
 * module is cockpit-layer and this one is consumed from the
 * application/practice authorization boundary, a lower layer that must
 * not depend upward on cockpit; and its own `!registryKey` branch has a
 * real, already-tested "unmapped key" contract (returns null) that this
 * module's permissive fallback (return the input unchanged) would have
 * silently changed. Only the 8 courses with a real compiled skill graph
 * need an entry: Practice content is always skill-graph-bound, so any
 * other course key legitimately has nothing to translate.
 */

const COCKPIT_TO_CANONICAL_COURSE_KEY: Readonly<Record<string, string>> = Object.freeze({
  'maths-premiere-eds': 'eds-maths-premiere',
  'maths-terminale-eds': 'eds-maths-terminale',
  'nsi-premiere-eds': 'eds-nsi-premiere',
  'nsi-terminale-eds': 'eds-nsi-terminale',
  'maths-premiere-stmg': 'stmg-maths-premiere',
  'sgn-premiere-stmg': 'stmg-sgn-premiere',
  'management-premiere-stmg': 'stmg-management-premiere',
  'droit-eco-premiere-stmg': 'stmg-droit-eco-premiere',
});

/**
 * Returns the canonical skill-graph registry key for a real cockpit course
 * key, or the input unchanged when it isn't one (already canonical, or a
 * real course with no skill graph at all — nothing to translate either
 * way, and the caller's own canonical-catalog lookup will correctly reject
 * a truly unknown key).
 */
export function toCanonicalAriaCourseKey(courseKey: string): string {
  return COCKPIT_TO_CANONICAL_COURSE_KEY[courseKey] ?? courseKey;
}
