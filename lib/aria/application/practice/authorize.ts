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
  // Deterministic on an unknown courseKey before touching the student
  // lookup — same reasoning as `resources/public.ts`.
  if (!isKnownCourseKey(input.courseKey) || !getCourse(input.courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }
  const context = await loadAuthorizedActorContext(input);
  const access = resolveAriaCourseAccess({
    courseKey: input.courseKey,
    student: context.student,
    entitlements: context.entitlements,
  });
  decidePracticeCourseAuthorization(access, context.capabilities);
  return { student: context.student };
}
