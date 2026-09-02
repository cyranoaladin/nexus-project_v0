import { AriaError } from '../../errors';

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
  courseKey: string,
  studentId: string,
): boolean {
  return resource.courseKey === courseKey
    && resource.visibility !== 'SYSTEM_ONLY'
    && (resource.visibility !== 'STUDENT_PRIVATE' || resource.ownerStudentId === studentId)
    && (resource.ownerStudentId === null
      || resource.ownerStudentId === undefined
      || resource.ownerStudentId === studentId);
}

export function assertAriaResourceAuthorization(
  resource: AriaResourceAuthorizationInput,
  courseKey: string,
  studentId: string,
): void {
  if (!isAriaResourceAuthorized(resource, courseKey, studentId)) {
    throw new AriaError(
      'RESOURCE_MISMATCH',
      400,
      'La ressource ne correspond pas au contexte autorisé.',
    );
  }
}
