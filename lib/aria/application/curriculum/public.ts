import { resolveStudentAriaCourses } from '../../access';
import { resolveInteractiveStudentActor } from '../../kernel/actor-subject';
import { buildCanonicalAriaEntitlementContext } from '../../kernel/entitlements';
import {
  getAriaPinnedCourseKeys,
} from '../conversation/build-context';
import { loadAriaAuthorizationStudent } from '../conversation/load-authorization-student';

export async function listAriaCurriculumForActor(input: {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly now?: Date;
}) {
  const actor = resolveInteractiveStudentActor(input.actor);
  const student = await loadAriaAuthorizationStudent(actor);
  const entitlements = buildCanonicalAriaEntitlementContext(
    student.user.entitlements,
    input.now ?? new Date(),
  );
  const courses = resolveStudentAriaCourses({
    student,
    pinnedCourseKeys: getAriaPinnedCourseKeys(student),
    entitlements,
  });
  return Object.freeze({
    courses,
    profile: student.ariaProfile ?? Object.freeze({
      preferencesVersion: 1,
      pinnedCourseKeys: Object.freeze([]),
      focusedCourseKey: null,
      courseOrder: Object.freeze([]),
      showCitations: true,
    }),
  });
}
