import { DocumentVisibilityScope } from '@prisma/client';

/** Shared by metadata queries and file authorization; unknown scopes fail closed. */
export const STUDENT_DOCUMENT_SCOPES = [
  DocumentVisibilityScope.STUDENT_ONLY,
  DocumentVisibilityScope.STUDENT_AND_PARENT,
  DocumentVisibilityScope.STUDENT_AND_COACH,
  DocumentVisibilityScope.STUDENT_PARENT_COACH,
] as const;

export function studentDocumentVisible(scope: string): boolean {
  return STUDENT_DOCUMENT_SCOPES.some(allowed => allowed === scope);
}
