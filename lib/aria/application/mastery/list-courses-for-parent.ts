/**
 * Parent course discovery (P6b): which ARIA courses a parent's real,
 * linked child actually has usable ARIA access to — the list this
 * module's own consumer (the parent cockpit UI) needs before it can ask
 * `list-course-mastery-for-parent.ts` for any one course's Mastery.
 *
 * "Available" here means the same three-gate AVAILABLE status
 * `resolveAriaCourseAccess` already computes for the self-service cockpit
 * (academically relevant + product supported + commercially entitled) —
 * never a looser or different definition for the parent view.
 */
import { courseLabel } from '@/lib/curriculum/catalog';
import { listStudentAcademicCourseKeys, resolveAriaCourseAccess } from '../../access';
import { buildCanonicalAriaEntitlementContext } from '../../kernel/entitlements';
import { resolveInteractiveParentActor } from '../../kernel/parent-subject';
import { loadChildForParent } from '../parent/load-child-for-parent';

export interface AriaParentChildCourse {
  readonly courseKey: string;
  readonly label: string;
}

export async function listAriaCoursesForParentChild(input: {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly studentId: string;
}): Promise<readonly AriaParentChildCourse[]> {
  const actor = resolveInteractiveParentActor(input.actor);
  const student = await loadChildForParent(actor.userId, input.studentId);

  const entitlements = buildCanonicalAriaEntitlementContext(student.user.entitlements, new Date());
  const candidateCourseKeys = listStudentAcademicCourseKeys(student);

  const available = candidateCourseKeys.filter((courseKey) => {
    const access = resolveAriaCourseAccess({ courseKey, student, entitlements });
    return access.status === 'AVAILABLE';
  });

  return Object.freeze(
    available.map((courseKey) => Object.freeze({ courseKey, label: courseLabel(courseKey) })),
  );
}
