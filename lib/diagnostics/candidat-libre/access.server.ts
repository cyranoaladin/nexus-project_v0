import 'server-only';

import type { AuthSession } from '@/lib/guards';
import { isErrorResponse, requireAnyRole, requireParentOwnsStudent } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';

export async function requireDiagnosticActor() {
  return requireAnyRole([UserRole.ELEVE, UserRole.PARENT, UserRole.COACH, UserRole.ADMIN, UserRole.ASSISTANTE]);
}

export async function getStudentForActor(session: AuthSession, requestedStudentId?: string) {
  if (session.user.role === UserRole.ELEVE) {
    return prisma.student.findUnique({
      where: { userId: session.user.id },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
  }
  if (!requestedStudentId) return null;
  if (session.user.role === UserRole.PARENT) {
    const ownership = await requireParentOwnsStudent(session.user.id, requestedStudentId);
    if (isErrorResponse(ownership)) return ownership;
  }
  return prisma.student.findUnique({
    where: { id: requestedStudentId },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  });
}

export async function getDiagnosticForActor(session: AuthSession, diagnosticId: string) {
  const diagnostic = await prisma.candidateDiagnostic.findUnique({
    where: { id: diagnosticId },
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      modules: { orderBy: { createdAt: 'asc' } },
      documents: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!diagnostic) return NextResponse.json({ error: 'Not Found', message: 'Diagnostic introuvable.' }, { status: 404 });

  if (session.user.role === UserRole.ELEVE && diagnostic.student.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.user.role === UserRole.PARENT) {
    const ownership = await requireParentOwnsStudent(session.user.id, diagnostic.studentId);
    if (isErrorResponse(ownership)) return ownership;
  }
  if (session.user.role === UserRole.COACH) {
    const assignment = await prisma.coachStudentAssignment.findFirst({
      where: { studentId: diagnostic.studentId, coach: { userId: session.user.id }, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return diagnostic;
}

export function actorRole(session: AuthSession): 'ELEVE' | 'PARENT' | 'COACH' | 'ADMIN' | 'SYSTEM' {
  if (session.user.role === UserRole.ELEVE) return 'ELEVE';
  if (session.user.role === UserRole.PARENT) return 'PARENT';
  if (session.user.role === UserRole.COACH) return 'COACH';
  return 'ADMIN';
}

// Documents in these categories are the student's own academic productions
// (a written copy, an oral recording) — equivalent in sensitivity to a
// detailed academic answer, not an administrative/identity document the
// family jointly manages. A PARENT viewer must not list or download them.
const STUDENT_ACADEMIC_DOCUMENT_CATEGORIES = new Set(['WRITTEN_COPY', 'ORAL_RECORDING']);

export function isDocumentVisibleToViewer(category: string, viewerRole: ReturnType<typeof actorRole>): boolean {
  if (viewerRole === 'PARENT' && STUDENT_ACADEMIC_DOCUMENT_CATEGORIES.has(category)) return false;
  return true;
}
