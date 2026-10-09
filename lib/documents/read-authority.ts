import { DocumentVisibilityScope, UserRole, type UserDocument } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { familyAuthorityAvailable, familyReadAllowed, resolveParentStudentAccess } from '@/lib/families/student-access-authority';
import { assertCoachCanAccessStudent } from '@/lib/rbac/coach-student-access';
import { studentDocumentVisible } from './student-visibility';

const STAFF_ROLES = new Set<string>([UserRole.ADMIN, UserRole.ASSISTANTE]);
const COACH_SCOPES = new Set<string>([
  DocumentVisibilityScope.STUDENT_AND_COACH, DocumentVisibilityScope.STUDENT_PARENT_COACH,
]);
const PARENT_SCOPES = new Set<string>([
  DocumentVisibilityScope.STUDENT_AND_PARENT, DocumentVisibilityScope.STUDENT_PARENT_COACH,
]);

type PrivateDocument = Pick<UserDocument,
  'id' | 'userId' | 'localPath' | 'unavailableReason' | 'mimeType' | 'originalName' | 'sizeBytes'>;
type ReadDecision = { readonly status: 'ALLOWED'; readonly document: PrivateDocument }
  | { readonly status: 'DENIED'; readonly response: NextResponse };
const deny = (status = 404): ReadDecision => ({ status: 'DENIED',
  response: new NextResponse(status === 403 ? 'Forbidden' : 'Not Found', { status,
    headers: { 'cache-control': 'private, no-store' } }),
});
const unavailable = (): ReadDecision => ({ status: 'DENIED',
  response: new NextResponse('Service Unavailable', { status: 503,
    headers: { 'cache-control': 'private, no-store' } }),
});

/** The two download URLs must share the same scope and family authority. */
export async function readAuthorizedDocument(id: string, subject: {
  readonly id: string; readonly role?: string | null; readonly authority?: string | null;
}): Promise<ReadDecision> {
  if (!id || !subject.id) return deny();
  if (subject.role === UserRole.COACH && subject.authority !== 'V1') return deny();
  // While family authority is down, a parent's denial must not reveal existence or visibility.
  const parentDeny = async (): Promise<ReadDecision> =>
    subject.role === UserRole.PARENT && !(await familyAuthorityAvailable(subject.id)) ? unavailable() : deny();
  const scope = await prisma.userDocument.findUnique({
    where: { id }, select: {
      id: true, userId: true, visibilityScope: true,
      user: { select: { id: true, student: { select: { id: true } } } },
    },
  });
  if (!scope) return parentDeny();
  const role = subject.role ?? '';
  // Administrative privacy is never overridden by direct family ownership.
  if (!STAFF_ROLES.has(role) && scope.visibilityScope === DocumentVisibilityScope.ADMIN_ONLY) return parentDeny();
  if (STAFF_ROLES.has(role)) {
    // Explicit administrative scope; no private file metadata loaded yet.
  } else if (role === UserRole.COACH) {
    if (!COACH_SCOPES.has(scope.visibilityScope) || !scope.user?.student) return deny();
    try {
      await assertCoachCanAccessStudent({ coachUserId: subject.id, studentId: scope.user.student.id });
    } catch {
      return deny();
    }
  } else if (role === UserRole.PARENT) {
    // A parent's own contractual archives do not derive from a child's current membership.
    if (scope.userId !== subject.id) {
      if (!PARENT_SCOPES.has(scope.visibilityScope) || !scope.user?.student) return parentDeny();
      const access = await resolveParentStudentAccess(subject.id, scope.user.student.id, 'read');
      if (access.status === 'AUTHORITY_UNAVAILABLE') return unavailable();
      if (!familyReadAllowed(access)) return deny();
    }
  } else if (role === UserRole.ELEVE) {
    if (scope.userId !== subject.id || !studentDocumentVisible(scope.visibilityScope)) return deny();
  } else return deny(403);

  // A changed owner/visibility cannot cross the authorization/private-read boundary.
  const document = await prisma.userDocument.findFirst({
    where: { id, userId: scope.userId, visibilityScope: scope.visibilityScope },
    select: { id: true, userId: true, localPath: true, unavailableReason: true,
      mimeType: true, originalName: true, sizeBytes: true },
  });
  return document ? { status: 'ALLOWED', document } : deny();
}
