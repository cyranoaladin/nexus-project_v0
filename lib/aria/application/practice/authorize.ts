/**
 * Practice authorization — mirrors `application/resources/public.ts`'s
 * `loadAuthorizedActorContext`/`authorizeCourseAccessForStudent` exactly
 * (same student-resolution, same `resolveAriaCourseAccess` course-access
 * gate), plus one addition: `resolveAriaCapabilities(tier).practice` — a
 * genuinely separate dimension (what this TIER may do, not whether ARIA is
 * reachable for this course at all). Neither check replaces the other; this
 * is the first real consumer of `resolveAriaCapabilities` anywhere in the
 * codebase.
 *
 * The decision itself (`decidePracticeCourseAuthorization`) is deliberately
 * a pure function taking already-resolved `access`/`capabilities` values,
 * not a DB-backed one: with today's real tier matrix, every tier that
 * grants course access (AUTONOMIE/SUIVI/ACCOMPAGNEE) also grants `practice`
 * — `practice: false` only occurs when `tier` is `null`, which
 * `access.commerciallyEntitled` already catches first. The `!practice`
 * branch below is real, forward-looking defense (a future tier redesign
 * could decouple the two), not dead code — but it's genuinely unreachable
 * through real seeded data today, so it's tested directly against this
 * pure function with a synthetic capabilities value, the same principle as
 * `lib/aria/cockpit/skill-views.ts`'s injectable-seam precedent.
 */
import { getCourse, isKnownCourseKey } from '@/lib/curriculum/catalog';
import { resolveAriaCourseAccess, type AriaCourseAccess } from '../../access';
import { toCanonicalAriaCourseKey } from '../../curriculum/course-key-aliases';
import { AriaError } from '../../errors';
import { resolveInteractiveStudentActor, resolveStudentSelfSubject } from '../../kernel/actor-subject';
import {
  buildCanonicalAriaEntitlementContext,
  resolveAriaCapabilities,
  type AriaCapabilities,
} from '../../kernel/entitlements';
import { loadAriaAuthorizationStudent } from '../conversation/load-authorization-student';

export interface AriaPracticeActorInput {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly now?: Date;
}

async function loadAuthorizedActorContext(input: AriaPracticeActorInput) {
  const actor = resolveInteractiveStudentActor(input.actor);
  const student = await loadAriaAuthorizationStudent(actor);
  resolveStudentSelfSubject(actor, student);
  const entitlements = buildCanonicalAriaEntitlementContext(
    student.user.entitlements,
    input.now ?? new Date(),
  );
  return { student, entitlements, capabilities: resolveAriaCapabilities(entitlements.tier) };
}

/** Pure: no I/O, directly unit-testable. Throws on the first failing gate, never partially. */
export function decidePracticeCourseAuthorization(
  access: AriaCourseAccess,
  capabilities: AriaCapabilities,
): void {
  if (!access.academicallyRelevant) {
    throw new AriaError('NOT_ENROLLED', 403, 'Ce cours ne fait pas partie du cursus scolaire actif.');
  }
  if (!access.commerciallyEntitled) {
    throw new AriaError('NOT_ENTITLED', 403, 'Aucun droit ARIA actif ne couvre ce cours.');
  }
  if (!capabilities.practice) {
    throw new AriaError(
      'NOT_ENTITLED',
      403,
      'La formule ARIA actuelle ne comprend pas les exercices.',
      { reasonCode: 'ARIA_TIER_PRACTICE_NOT_INCLUDED' },
    );
  }
}

export async function authorizePracticeCourseForActor(
  input: AriaPracticeActorInput & { readonly courseKey: string },
) {
  // The real cockpit UI passes its own product-catalog course key (e.g.
  // `maths-premiere-eds`, `lib/aria/curriculum/catalog.ts`), not the
  // canonical skill-graph registry key (`eds-maths-premiere`) this module
  // — like the chat pipeline's own `build-context.ts` — has always
  // validated against. Translate once, here, before anything else: a
  // no-op for a caller that already passes the canonical key directly
  // (every real-DB test in this codebase, and any future non-cockpit
  // caller), a real bridge for the cockpit's own course cards.
  const courseKey = toCanonicalAriaCourseKey(input.courseKey);

  // Deterministic on an unknown courseKey before touching the student
  // lookup — same reasoning as `resources/public.ts`.
  if (!isKnownCourseKey(courseKey) || !getCourse(courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }
  const context = await loadAuthorizedActorContext(input);
  const access = resolveAriaCourseAccess({
    courseKey,
    student: context.student,
    entitlements: context.entitlements,
  });
  decidePracticeCourseAuthorization(access, context.capabilities);
  return { student: context.student, courseKey };
}

/**
 * Correction is a genuinely separate capability (`practiceCorrection`, not
 * `practice`) — deliberately re-checked at correction time, unlike
 * `submitAriaPracticeAttempt`'s ownership-only check: correction triggers a
 * new, real model call each time it actually runs (not just persisting
 * already-done work), so it's gated on the student's CURRENT entitlement,
 * not their entitlement at attempt-start time. With today's real tier
 * matrix `practiceCorrection` is granted at the same base tier as
 * `practice`, so the `!practiceCorrection` branch is real forward-looking
 * defense, currently unreachable through real seeded data — same
 * `decidePracticeCourseAuthorization` precedent, tested directly with a
 * synthetic capabilities value.
 */
export function decidePracticeCorrectionAuthorization(
  access: AriaCourseAccess,
  capabilities: AriaCapabilities,
): void {
  if (!access.academicallyRelevant) {
    throw new AriaError('NOT_ENROLLED', 403, 'Ce cours ne fait pas partie du cursus scolaire actif.');
  }
  if (!access.commerciallyEntitled) {
    throw new AriaError('NOT_ENTITLED', 403, 'Aucun droit ARIA actif ne couvre ce cours.');
  }
  if (!capabilities.practiceCorrection) {
    throw new AriaError(
      'NOT_ENTITLED',
      403,
      'La formule ARIA actuelle ne comprend pas la correction des exercices.',
      { reasonCode: 'ARIA_TIER_PRACTICE_CORRECTION_NOT_INCLUDED' },
    );
  }
}

export async function authorizePracticeCorrectionForActor(
  input: AriaPracticeActorInput & { readonly courseKey: string },
) {
  // Same cockpit-key/canonical-key bridge as authorizePracticeCourseForActor
  // — see its own comment. This function's own caller (`correct-attempt.ts`)
  // always passes the real Attempt's own stored (already-canonical)
  // courseKey, so this is a no-op in practice today, but keeping the same
  // bridge here too means neither function silently diverges if a future
  // caller ever passes a cockpit-origin key directly.
  const courseKey = toCanonicalAriaCourseKey(input.courseKey);

  if (!isKnownCourseKey(courseKey) || !getCourse(courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }
  const context = await loadAuthorizedActorContext(input);
  const access = resolveAriaCourseAccess({
    courseKey,
    student: context.student,
    entitlements: context.entitlements,
  });
  decidePracticeCorrectionAuthorization(access, context.capabilities);
  return { student: context.student, courseKey };
}
