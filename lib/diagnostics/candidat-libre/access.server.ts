import 'server-only';

import type { AuthSession } from '@/lib/guards';
import { isErrorResponse, requireAnyRole, requireParentOwnsStudent } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import type { DiagnosticAudience } from './types';

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

// actorRole feeds ONLY the CandidateDiagnosticActorRole audit-log column,
// whose Postgres enum has no ASSISTANTE value (ELEVE/PARENT/COACH/ADMIN/
// SYSTEM only — see prisma/migrations/20260807140000_add_candidate_diagnostic).
// It has always collapsed ASSISTANTE into ADMIN for that reason, and still
// does — this is not a new gap. Read-visibility rules (canViewModuleDetail,
// isDocumentVisibleToViewer) need ASSISTANTE distinguished from ADMIN, so
// they take the raw UserRole from the session instead of routing through
// this function. Do not repurpose actorRole() for anything read-visibility
// related without also deciding whether ASSISTANTE needs its own DB enum
// value (a new migration) — collapsing it silently here would misattribute
// audit entries.
export function actorRole(session: AuthSession): 'ELEVE' | 'PARENT' | 'COACH' | 'ADMIN' | 'SYSTEM' {
  if (session.user.role === UserRole.ELEVE) return 'ELEVE';
  if (session.user.role === UserRole.PARENT) return 'PARENT';
  if (session.user.role === UserRole.COACH) return 'COACH';
  return 'ADMIN';
}

// Single source of truth for READ visibility of a module's content
// (answers/autoScore/manualScore/reviewSummary), separate from
// canEditAudience (lib/diagnostics/candidat-libre/[diagnosticId]/modules/
// [moduleKey]/route.ts) which governs who may WRITE answers — conflating
// the two previously produced a false parallel: a role blocked from
// editing was assumed blocked from reading too, which isn't true for COACH
// (works from the student's own detail, never edits it) and isn't the
// right default for ASSISTANTE either (logistics role, no academic or
// family-confidential detail, on ANY module — see below).
//
// Arbitrated matrix (2026-08-07):
// - ELEVE/PARENT: full detail on their own audience's modules only.
// - COACH: full detail on ELEVE-audience modules (their working material);
//   status/progress only on the PARENT-audience module (questionnaire-parent).
// - ASSISTANTE: no academic detail anywhere — status/progress only, on
//   every module regardless of audience. Logistics role, least privilege
//   on a minor's data.
// - ADMIN: full detail everywhere, including questionnaire-parent — this
//   is where the confidential family instrument is meant to land.
export function canViewModuleDetail(role: UserRole, moduleAudience: DiagnosticAudience): boolean {
  if (role === UserRole.ADMIN) return true;
  if (role === UserRole.ASSISTANTE) return false;
  if (role === UserRole.COACH) return moduleAudience === 'ELEVE';
  if (role === UserRole.ELEVE) return moduleAudience === 'ELEVE';
  if (role === UserRole.PARENT) return moduleAudience === 'PARENT';
  return false;
}

// Documents in these categories are the student's own academic productions
// (a written copy, an oral recording) — equivalent in sensitivity to a
// detailed academic answer, not an administrative/identity document the
// family jointly manages. A PARENT viewer must not list or download them
// (arbitrated 2026-08-07, ADR pending: the parent portal never serves them
// in self-service — a parent request goes through pedagogical direction in
// a review meeting, not through this API). ASSISTANTE is excluded for the
// same least-privilege reason as canViewModuleDetail: logistics role, no
// standing to view a minor's academic productions. COACH keeps access —
// it is their working material for coaching the student.
const STUDENT_ACADEMIC_DOCUMENT_CATEGORIES = new Set(['WRITTEN_COPY', 'ORAL_RECORDING']);

export function isDocumentVisibleToViewer(category: string, viewerRole: UserRole): boolean {
  if (
    STUDENT_ACADEMIC_DOCUMENT_CATEGORIES.has(category)
    && (viewerRole === UserRole.PARENT || viewerRole === UserRole.ASSISTANTE)
  ) {
    return false;
  }
  return true;
}
