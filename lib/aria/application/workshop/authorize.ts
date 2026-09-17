/**
 * Collective workshop authorization (P7d) — mirrors
 * `application/practice/authorize.ts` exactly (same student-resolution,
 * same `resolveAriaCourseAccess` course-access gate), checking
 * `capabilities.collectiveWorkshop` instead of `.practice`: the first real
 * consumer of that capability field anywhere in the codebase (declared in
 * `kernel/entitlements.ts` since the tier matrix was built, never read by
 * a real authorization path until now).
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

export interface AriaWorkshopActorInput {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly now?: Date;
}

/** Pure: no I/O, directly unit-testable — same shape as decidePracticeCourseAuthorization. */
export function decideWorkshopEligibility(
  access: AriaCourseAccess,
  capabilities: AriaCapabilities,
): void {
  if (!access.academicallyRelevant) {
    throw new AriaError('NOT_ENROLLED', 403, 'Ce cours ne fait pas partie du cursus scolaire actif.');
  }
  if (!access.commerciallyEntitled) {
    throw new AriaError('NOT_ENTITLED', 403, 'Aucun droit ARIA actif ne couvre ce cours.');
  }
  if (!capabilities.collectiveWorkshop) {
    throw new AriaError(
      'NOT_ENTITLED',
      403,
      'La formule ARIA actuelle ne comprend pas les ateliers collectifs.',
      { reasonCode: 'ARIA_TIER_COLLECTIVE_WORKSHOP_NOT_INCLUDED' },
    );
  }
}

export async function authorizeWorkshopCourseForActor(
  input: AriaWorkshopActorInput & { readonly courseKey: string },
): Promise<{ readonly student: Awaited<ReturnType<typeof loadAriaAuthorizationStudent>>; readonly courseKey: string }> {
  // The real cockpit UI passes its own product-catalog course key — same
  // bridge as authorizePracticeCourseForActor (practice/authorize.ts),
  // required here for exactly the same reason: a no-op for any caller
  // that already passes the canonical key directly.
  const courseKey = toCanonicalAriaCourseKey(input.courseKey);

  if (!isKnownCourseKey(courseKey) || !getCourse(courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }
  const actor = resolveInteractiveStudentActor(input.actor);
  const student = await loadAriaAuthorizationStudent(actor);
  resolveStudentSelfSubject(actor, student);
  const entitlements = buildCanonicalAriaEntitlementContext(student.user.entitlements, input.now ?? new Date());
  const capabilities = resolveAriaCapabilities(entitlements.tier);
  const access = resolveAriaCourseAccess({ courseKey, student, entitlements });
  decideWorkshopEligibility(access, capabilities);
  return { student, courseKey };
}
