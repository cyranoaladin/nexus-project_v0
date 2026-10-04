/**
 * Authentication & Authorization Guards for API Routes
 *
 * Centralized functions to check user authentication and role-based access control (RBAC).
 * Use these guards at the beginning of API route handlers to enforce security.
 */

import { auth } from '@/auth';
import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { buildInvoiceAccessWhere } from './invoice/not-found';
import { familyReadAllowed, resolveParentStudentAccess } from './families/student-access-authority';

export type AuthSession = {
  user: {
    id: string;
    email: string | null;
    role: UserRole;
    firstName?: string;
    lastName?: string;
    name?: string | null;
    image?: string | null;
  };
  expires: string;
};

/**
 * Require authenticated session
 */
export async function requireAuth(): Promise<AuthSession | NextResponse> {
  let session;
  try {
    session = await auth();
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication failed' },
      { status: 401 }
    );
  }

  if (!session || !session.user) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'You must be signed in to access this resource'
      },
      { status: 401 }
    );
  }

  // Validate session structure
  if (!session.user.id || !session.user.role) {
      console.error('Invalid session structure', { userId: session.user.id });
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid session' },
        { status: 401 }
      );
  }

  if (!session.user.email && session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid session state' },
        { status: 401 }
      );
  }

  return session as unknown as AuthSession;
}

/**
 * Require specific role
 */
export async function requireRole(requiredRole: UserRole): Promise<AuthSession | NextResponse> {
  const result = await requireAuth();

  if (isErrorResponse(result)) {
    return result;
  }

  const session = result as AuthSession;

  if (session.user.role !== requiredRole) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: `Access denied. Required role: ${requiredRole}`
      },
      { status: 403 }
    );
  }

  return session;
}

/**
 * Require one of multiple roles
 */
export async function requireAnyRole(allowedRoles: UserRole[]): Promise<AuthSession | NextResponse> {
  const result = await requireAuth();

  if (isErrorResponse(result)) {
    return result;
  }

  const session = result as AuthSession;

  if (!allowedRoles.includes(session.user.role)) {

    return NextResponse.json(
      {
        error: 'Forbidden',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
      },
      { status: 403 }
    );
  }

  return session;
}

/**
 * Check if the authenticated user owns the resource
 */
export function isOwner(session: AuthSession, userId: string): boolean {
  return session.user.id === userId;
}

/**
 * Check if the authenticated user is staff (ADMIN or ASSISTANTE)
 */
export function isStaff(session: AuthSession): boolean {
  return ['ADMIN', 'ASSISTANTE'].includes(session.user.role);
}

// Helper to check if result is an error response (Exported for consumers)
export function isErrorResponse(result: unknown): result is NextResponse {
  if (typeof result !== 'object' || result === null) return false;
  const r = result as { json?: unknown; status?: unknown };
  return typeof r.json === 'function' && 'status' in (result as object);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Ownership Guards
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify that a parent owns the given student.
 * Returns true if ownership is confirmed, otherwise a 403 NextResponse.
 */
export async function requireParentOwnsStudent(
  parentUserId: string,
  studentId: string,
  action: 'read' | 'mutation'
): Promise<true | NextResponse> {
  const decision = await resolveParentStudentAccess(parentUserId, studentId, action);
  if (decision.status === 'AUTHORITY_UNAVAILABLE') {
    return NextResponse.json(
      { error: 'ServiceUnavailable', message: 'La vérification des droits est temporairement indisponible.' },
      { status: 503 }
    );
  }
  if (!familyReadAllowed(decision)) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Vous n\'êtes pas autorisé à accéder à cet élève.' },
      { status: 403 }
    );
  }
  return true;
}

/**
 * Verify that a coach is assigned to the given student.
 * Returns true if assignment exists, otherwise a 403 NextResponse.
 */
export async function requireCoachAssignedToStudent(
  coachUserId: string,
  studentId: string
): Promise<true | NextResponse> {
  // coachStudentAssignment.coachId references CoachProfile.id, which is distinct
  // from User.id — resolve through the relation rather than comparing ids directly.
  const assignment = await prisma.coachStudentAssignment.findFirst({
    where: { studentId, status: 'ACTIVE', coach: { userId: coachUserId } },
    select: { id: true },
  });
  if (!assignment) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Cet élève ne fait pas partie de votre portefeuille.' },
      { status: 403 }
    );
  }
  return true;
}

/**
 * Verify that the authenticated student matches the resource owner.
 * Returns true if the student userId matches, otherwise a 403 NextResponse.
 */
export async function requireStudentOwnsResource(
  studentUserId: string,
  resourceStudentId: string
): Promise<true | NextResponse> {
  if (studentUserId === resourceStudentId) return true;
  return NextResponse.json(
    { error: 'Forbidden', message: 'Accès refusé à cette ressource.' },
    { status: 403 }
  );
}

/** Resolve Student.id from the authenticated User.id before attaching a resource. */
export async function requireStudentOwnsStudent(
  studentUserId: string,
  studentId: string
): Promise<true | NextResponse> {
  let student: { id: string } | null;
  try {
    student = await prisma.student.findUnique({
      where: { userId: studentUserId }, select: { id: true },
    });
  } catch {
    return NextResponse.json(
      { error: 'ServiceUnavailable', message: 'La vérification des droits est temporairement indisponible.' },
      { status: 503 }
    );
  }
  if (!student || student.id !== studentId) {
    return NextResponse.json({ error: 'Forbidden', message: 'Accès refusé à cette ressource.' }, { status: 403 });
  }
  return true;
}

/** Require explicit payer or active delegated authority; family membership grants no finance access. */
export async function requireParentOwnsInvoice(
  parentUserId: string,
  invoiceId: string
): Promise<true | NextResponse> {
  const where = await buildInvoiceAccessWhere(invoiceId, { id: parentUserId, role: 'PARENT' });
  const invoice = where ? await prisma.invoice.findFirst({ where, select: { id: true } }) : null;
  if (!invoice) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Cette facture ne vous appartient pas.' },
      { status: 403 }
    );
  }
  return true;
}

/**
 * Require ownership for a policy that has allowOwner=true.
 * Checks the policy, then verifies ownership based on the resource type.
 * This is the canonical way to enforce allowOwner in RBAC.
 */
export async function enforceOwnership(
  policyKey: string,
  session: AuthSession,
  resourceId: string | undefined,
  action: 'read' | 'mutation'
): Promise<true | NextResponse> {
  // Parent ownership on student
  if (policyKey === 'parent.children' && resourceId) {
    return requireParentOwnsStudent(session.user.id, resourceId, action);
  }
  // Parent ownership on invoice
  if (policyKey.startsWith('parent.') && policyKey.includes('invoice') && resourceId) {
    return requireParentOwnsInvoice(session.user.id, resourceId);
  }
  // Coach assignment check
  if (policyKey.startsWith('coach.') && resourceId) {
    return requireCoachAssignedToStudent(session.user.id, resourceId);
  }
  // Student self check
  if (policyKey.startsWith('student.') && resourceId) {
    return requireStudentOwnsResource(session.user.id, resourceId);
  }
  // Default: no ownership check needed for this policy
  return true;
}
