import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { isErrorResponse } from '@/lib/guards';
import { getDiagnosticForActor, isDocumentVisibleToViewer, requireDiagnosticActor, actorRole } from '@/lib/diagnostics/candidat-libre/access.server';
import { buildStaffDiagnosticSynthesis } from '@/lib/diagnostics/candidat-libre/synthesis.server';
import { guardCandidateDiagnosticFeature } from '@/lib/diagnostics/candidat-libre/feature-flag';

interface Params { params: Promise<{ diagnosticId: string }> }

// Same rule as modules/[moduleKey]: a COACH sees module structure/status but
// never raw answers or scores — the questionnaire-parent module in particular
// is not COACH's audience. Only ADMIN/ASSISTANTE (pedagogical direction) see
// content. Kept local rather than importing canEditAudience from the module
// route: that helper is audience-conditional (ELEVE/PARENT edit their own),
// which doesn't apply here — staff-export is read-only for staff.
function canViewModuleContent(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.ASSISTANTE;
}

export async function GET(_request: Request, { params }: Params) {
  const disabled = guardCandidateDiagnosticFeature();
  if (disabled) return disabled;
  const { diagnosticId } = await params;
  const sessionOrError = await requireDiagnosticActor();
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  if (!([UserRole.COACH, UserRole.ADMIN, UserRole.ASSISTANTE] as UserRole[]).includes(sessionOrError.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const diagnosticOrError = await getDiagnosticForActor(sessionOrError, diagnosticId);
  if (diagnosticOrError instanceof NextResponse) return diagnosticOrError;

  return NextResponse.json({
    diagnostic: {
      id: diagnosticOrError.id,
      diagnosticKey: diagnosticOrError.diagnosticKey,
      definitionVersion: diagnosticOrError.definitionVersion,
      targetSession: diagnosticOrError.targetSession,
      status: diagnosticOrError.status,
      student: {
        id: diagnosticOrError.student.id,
        firstName: diagnosticOrError.student.user.firstName,
        lastName: diagnosticOrError.student.user.lastName,
        email: diagnosticOrError.student.user.email,
        school: diagnosticOrError.student.school,
        gradeLevel: diagnosticOrError.student.gradeLevel,
      },
      modules: diagnosticOrError.modules.map((module: any) => {
        const canViewContent = canViewModuleContent(sessionOrError.user.role);
        return {
          moduleKey: module.moduleKey,
          audience: module.audience,
          status: module.status,
          answers: canViewContent ? module.answers : undefined,
          autoScore: canViewContent ? module.autoScore : undefined,
          manualScore: canViewContent ? module.manualScore : undefined,
          integrity: module.integrity,
          elapsedMs: module.elapsedMs,
          submittedAt: module.submittedAt,
          reviewSummary: canViewContent ? module.reviewSummary : undefined,
          definitionSnapshot: module.definitionSnapshot,
        };
      }),
      documents: diagnosticOrError.documents
        .filter((document: any) => isDocumentVisibleToViewer(document.category, actorRole(sessionOrError)))
        .map((document: any) => ({
          id: document.id,
          category: document.category,
          title: document.title,
          originalName: document.originalName,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
          sha256: document.sha256,
          status: document.status,
          reviewNote: document.reviewNote,
          createdAt: document.createdAt,
        })),
      studentConsentAt: diagnosticOrError.studentConsentAt,
      parentConsentAt: diagnosticOrError.parentConsentAt,
      parentSubmittedAt: diagnosticOrError.parentSubmittedAt,
      submittedAt: diagnosticOrError.submittedAt,
    },
    synthesis: buildStaffDiagnosticSynthesis(diagnosticOrError),
  }, {
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
