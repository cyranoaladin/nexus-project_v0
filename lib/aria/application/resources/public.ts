import { getCourse, isKnownCourseKey } from '@/lib/curriculum/catalog';
import { resolveAriaCourseAccess } from '../../access';
import { getCourseCapabilities } from '../../curriculum';
import { AriaError } from '../../errors';
import { resolveInteractiveStudentActor, resolveStudentSelfSubject } from '../../kernel/actor-subject';
import { buildCanonicalAriaEntitlementContext } from '../../kernel/entitlements';
import { getResource, listResourcesForCourse } from '../../resources';
import {
  assertAriaResourceAuthorization,
  loadAriaAuthorizationStudent,
} from '../conversation/build-context';

interface AriaResourceActorInput {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly now?: Date;
}

async function authorizeResourceCourse(
  input: AriaResourceActorInput & { readonly courseKey: string },
) {
  const actor = resolveInteractiveStudentActor(input.actor);
  if (!isKnownCourseKey(input.courseKey) || !getCourse(input.courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }
  const student = await loadAriaAuthorizationStudent(actor);
  resolveStudentSelfSubject(actor, student);
  const entitlements = buildCanonicalAriaEntitlementContext(
    student.user.entitlements,
    input.now ?? new Date(),
  );
  const access = resolveAriaCourseAccess({
    courseKey: input.courseKey,
    student,
    entitlements,
  });
  if (!access.academicallyRelevant) {
    throw new AriaError('NOT_ENROLLED', 403, 'Ce cours ne fait pas partie du cursus scolaire actif.');
  }
  if (!access.productSupported || !getCourseCapabilities(input.courseKey).hasResources) {
    throw new AriaError('UNSUPPORTED', 422, 'Aucune ressource ARIA n’est disponible pour ce cours.');
  }
  if (!access.commerciallyEntitled) {
    throw new AriaError('NOT_ENTITLED', 403, 'Aucun droit ARIA actif ne couvre ce cours.');
  }
  return { student, access };
}

export async function listAriaResourcesForActor(
  input: AriaResourceActorInput & { readonly courseKey: string },
) {
  await authorizeResourceCourse(input);
  return Object.freeze({
    courseKey: input.courseKey,
    resources: Object.freeze([...listResourcesForCourse(input.courseKey)]),
  });
}

export async function authorizeAriaResourceForActor(
  input: AriaResourceActorInput & { readonly resourceId: string },
) {
  const resource = getResource(input.resourceId);
  if (!resource) {
    throw new AriaError('RESOURCE_MISMATCH', 404, 'Ressource ARIA introuvable.');
  }
  const { student } = await authorizeResourceCourse({
    actor: input.actor,
    courseKey: resource.courseKey,
    now: input.now,
  });
  assertAriaResourceAuthorization(resource, resource.courseKey, student.id);
  return Object.freeze({ resource });
}
