import { resolveStudentAriaCourses } from '../../access';
import { AriaError } from '../../errors';
import { resolveInteractiveStudentActor } from '../../kernel/actor-subject';
import { buildCanonicalAriaEntitlementContext } from '../../kernel/entitlements';
import {
  getAriaPinnedCourseKeys,
  loadAriaAuthorizationStudent,
} from '../conversation/build-context';

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
    selectedCourseKeys: getAriaPinnedCourseKeys(student),
    entitlements,
  });
  if (!student.ariaProfile) {
    throw new AriaError('NOT_ENROLLED', 409, 'Le profil d’apprentissage ARIA doit être configuré.');
  }
  return Object.freeze({
    courses,
    profile: student.ariaProfile,
  });
}
