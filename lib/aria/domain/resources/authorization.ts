import { AriaError } from '../../errors';

/**
 * `courseKey` here is deliberately NOT a caller-supplied comparison value —
 * it is read only as evidence that `resource` already carries a proven
 * placement (see `AriaResourceAuthorizationInput`'s own contract below).
 * There is no longer a second, independently-supplied `courseKey` parameter
 * a caller could mismatch against it: the only way to obtain a value shaped
 * like this is `getResourceForCourse(resourceId, courseKey)` or
 * `listResourcesForCourse(courseKey)` (`lib/aria/resources.ts`), both of
 * which refuse to return a resource that is not actually placed in that
 * course. An unauthorized "resource + arbitrary courseKey" pair is therefore
 * unrepresentable at this boundary, not merely checked at runtime.
 */
export interface AriaResourceAuthorizationInput {
  readonly courseKey: string;
  readonly ownerStudentId?: string | null;
  readonly visibility?:
    | 'PUBLIC'
    | 'STUDENT_PRIVATE'
    | 'COACH_VISIBLE'
    | 'PARENT_VISIBLE'
    | 'SYSTEM_ONLY';
}

export function isAriaResourceAuthorized(
  resource: AriaResourceAuthorizationInput,
  studentId: string,
): boolean {
  return resource.visibility !== 'SYSTEM_ONLY'
    && (resource.visibility !== 'STUDENT_PRIVATE' || resource.ownerStudentId === studentId)
    && (resource.ownerStudentId === null
      || resource.ownerStudentId === undefined
      || resource.ownerStudentId === studentId);
}

export function assertAriaResourceAuthorization(
  resource: AriaResourceAuthorizationInput,
  studentId: string,
): void {
  if (!isAriaResourceAuthorized(resource, studentId)) {
    throw new AriaError(
      'RESOURCE_MISMATCH',
      400,
      'La ressource ne correspond pas au contexte autorisé.',
    );
  }
}
