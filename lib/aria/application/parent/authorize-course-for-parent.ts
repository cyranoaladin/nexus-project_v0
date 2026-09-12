/**
 * Shared parent+course authorization (P7a) — the exact same three-gate
 * check `list-course-mastery-for-parent.ts` (P6a) already inlines for
 * itself: real child ownership (`loadChildForParent`, scoped to the
 * requesting parent's own `ParentProfile.children`), academic relevance,
 * commercial entitlement — re-derived from the CHILD's own data, never
 * the parent's.
 *
 * Extracted as a new shared seam for this lot's two new parent read paths
 * (recent activity, next-best-action) rather than refactoring
 * `list-course-mastery-for-parent.ts` itself to use it: that module is
 * already shipped and tested — a retrofit risks it for zero behavioral
 * gain. New consumers get the shared helper; the existing one keeps its
 * own inlined copy.
 */
import { getCourse, isKnownCourseKey } from '@/lib/curriculum/catalog';
import { resolveAriaCourseAccess } from '../../access';
import { buildCanonicalAriaEntitlementContext } from '../../kernel/entitlements';
import { AriaError } from '../../kernel/errors';
import { resolveInteractiveParentActor } from '../../kernel/parent-subject';
import { loadChildForParent, type ChildForParentView } from './load-child-for-parent';

export interface AriaParentCourseActorInput {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly studentId: string;
  readonly courseKey: string;
}

export async function authorizeCourseAccessForParent(
  input: AriaParentCourseActorInput,
): Promise<{ readonly student: ChildForParentView; readonly courseKey: string }> {
  const actor = resolveInteractiveParentActor(input.actor);

  if (!isKnownCourseKey(input.courseKey) || !getCourse(input.courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }

  const student = await loadChildForParent(actor.userId, input.studentId);

  const entitlements = buildCanonicalAriaEntitlementContext(student.user.entitlements, new Date());
  const access = resolveAriaCourseAccess({ courseKey: input.courseKey, student, entitlements });
  if (!access.academicallyRelevant) {
    throw new AriaError('NOT_ENROLLED', 403, 'Ce cours ne fait pas partie du cursus scolaire actif de cet élève.');
  }
  if (!access.commerciallyEntitled) {
    throw new AriaError('NOT_ENTITLED', 403, 'Aucun droit ARIA actif ne couvre ce cours pour cet élève.');
  }

  return { student, courseKey: input.courseKey };
}
