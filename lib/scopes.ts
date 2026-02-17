/**
 * Student Scope Resolution — Centralized helper for resolving which student
 * a given authenticated user is allowed to view.
 *
 * Prevents cross-scope data leaks: a parent can only see their own children,
 * an ELEVE can only see themselves, ADMIN/ASSISTANTE can see any student.
 *
 * Usage:
 *   const scope = await resolveStudentScope(session, { studentId });
 *   if (!scope.authorized) return NextResponse.json({ error: scope.error }, { status: 403 });
 *   // scope.studentId is the resolved, authorized student ID
 */

import { prisma } from '@/lib/prisma';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Session-like object (subset of NextAuth session) */
export interface SessionUser {
  id: string;
  role: string;
}

/** Options for scope resolution */
export interface ScopeOptions {
  /** Explicit studentId requested (e.g. from query param) */
  studentId?: string | null;
}

/** Successful scope resolution */
export interface ScopeResolved {
  authorized: true;
  /** The resolved Student.id (Prisma model ID, not User.id) */
  studentId: string;
  /** The student's User.id */
  studentUserId: string;
}

/** Failed scope resolution */
export interface ScopeDenied {
  authorized: false;
  error: string;
}

export type ScopeResult = ScopeResolved | ScopeDenied;

// ─── Constants ───────────────────────────────────────────────────────────────

/** Roles that can view any student */
const ADMIN_ROLES = ['ADMIN', 'ASSISTANTE'];

/** Roles that have student-scoped access */
const STUDENT_ROLES = ['ELEVE'];

/** Roles that access via parent→child relationship */
const PARENT_ROLES = ['PARENT'];

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Resolve which student the authenticated user is authorized to view.
 *
 * Rules:
 * - ELEVE: always resolves to their own student record
 * - PARENT: resolves to the requested child (if owned), or first child if none specified
 * - ADMIN/ASSISTANTE: resolves to any requested student, or returns error if none specified
 * - COACH: not supported (coach dashboards don't use student scope)
 *
 * @param user - The authenticated user (id + role)
 * @param options - Optional studentId override
 * @returns ScopeResult with authorized studentId or error
 */
export async function resolveStudentScope(
  user: SessionUser,
  options: ScopeOptions = {}
): Promise<ScopeResult> {
  const { studentId: requestedStudentId } = options;

  // ─── ELEVE ─────────────────────────────────────────────────────────────────
  if (STUDENT_ROLES.includes(user.role)) {
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true, userId: true },
    });

    if (!student) {
      return { authorized: false, error: 'Profil élève introuvable' };
    }

    // ELEVE cannot request a different student
    if (requestedStudentId && requestedStudentId !== student.id) {
      return { authorized: false, error: 'Accès restreint à votre périmètre' };
    }

    return { authorized: true, studentId: student.id, studentUserId: student.userId };
  }

  // ─── PARENT ────────────────────────────────────────────────────────────────
  if (PARENT_ROLES.includes(user.role)) {
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: user.id },
      select: {
        children: {
          select: { id: true, userId: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!parentProfile || parentProfile.children.length === 0) {
      return { authorized: false, error: 'Aucun enfant associé à votre compte' };
    }

    // If a specific child is requested, verify ownership
    if (requestedStudentId) {
      const child = parentProfile.children.find((c) => c.id === requestedStudentId);
      if (!child) {
        return { authorized: false, error: 'Accès restreint à votre périmètre' };
      }
      return { authorized: true, studentId: child.id, studentUserId: child.userId };
    }

    // Default: first child
    const firstChild = parentProfile.children[0];
    return { authorized: true, studentId: firstChild.id, studentUserId: firstChild.userId };
  }

  // ─── ADMIN / ASSISTANTE ────────────────────────────────────────────────────
  if (ADMIN_ROLES.includes(user.role)) {
    if (!requestedStudentId) {
      return { authorized: false, error: 'Identifiant élève requis pour ce rôle' };
    }

    const student = await prisma.student.findUnique({
      where: { id: requestedStudentId },
      select: { id: true, userId: true },
    });

    if (!student) {
      return { authorized: false, error: 'Élève introuvable' };
    }

    return { authorized: true, studentId: student.id, studentUserId: student.userId };
  }

  // ─── Unsupported role ──────────────────────────────────────────────────────
  return { authorized: false, error: 'Rôle non autorisé pour cette ressource' };
}

/**
 * Get all children for a parent user.
 * Returns an empty array for non-parent roles.
 */
export async function getParentChildren(
  userId: string
): Promise<Array<{ id: string; userId: string; firstName: string; lastName: string; grade: string | null }>> {
  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId },
    select: {
      children: {
        select: {
          id: true,
          userId: true,
          user: {
            select: { firstName: true, lastName: true },
          },
          grade: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!parentProfile) return [];

  return parentProfile.children.map((child) => ({
    id: child.id,
    userId: child.userId,
    firstName: child.user.firstName ?? '',
    lastName: child.user.lastName ?? '',
    grade: child.grade,
  }));
}
