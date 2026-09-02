import {
  listStudentAcademicCourseKeys,
  resolveStudentAriaCourses,
} from '../../access';
import { resolveInteractiveStudentActor } from '../../kernel/actor-subject';
import { buildCanonicalAriaEntitlementContext } from '../../kernel/entitlements';
import { resolveStoredAriaLearningPreferencesV1 } from '../../domain/profile/preferences';
import { loadAriaAuthorizationStudent } from '../conversation/load-authorization-student';

function applyCourseOrder<T extends { readonly courseKey: string }>(
  courses: readonly T[],
  courseOrder: readonly string[],
): readonly T[] {
  const byCourseKey = new Map(courses.map((course) => [course.courseKey, course]));
  // The canonical profile projector has already restricted courseOrder to this Academic Map.
  const ordered = courseOrder.map((courseKey) => byCourseKey.get(courseKey)!);
  const explicitlyOrdered = new Set(courseOrder);
  return Object.freeze([
    ...ordered,
    ...courses.filter(({ courseKey }) => !explicitlyOrdered.has(courseKey)),
  ]);
}

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
  const profile = resolveStoredAriaLearningPreferencesV1(
    student.ariaProfile,
    listStudentAcademicCourseKeys(student),
  );
  const courses = applyCourseOrder(resolveStudentAriaCourses({
    student,
    pinnedCourseKeys: profile.pinnedCourseKeys,
    entitlements,
  }), profile.courseOrder);
  return Object.freeze({
    courses,
    profile,
  });
}
