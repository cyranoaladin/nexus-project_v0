import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { isErrorResponse } from '@/lib/guards';
import { canViewModuleDetail, getDiagnosticForActor, isDocumentVisibleToViewer, requireDiagnosticActor } from '@/lib/diagnostics/candidat-libre/access.server';
import { buildStaffDiagnosticSynthesis } from '@/lib/diagnostics/candidat-libre/synthesis.server';
import { guardCandidateDiagnosticFeature } from '@/lib/diagnostics/candidat-libre/feature-flag';

interface Params { params: Promise<{ diagnosticId: string }> }

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
        const canViewContent = canViewModuleDetail(sessionOrError.user.role, module.audience);
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
        .filter((document: any) => isDocumentVisibleToViewer(document.category, sessionOrError.user.role))
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
    // The synthesis aggregates academic detail (percentages, coverage,
    // learning-potential flags derived from module content) across every
    // module — the same "no academic detail" boundary that governs modules[]
    // above applies here: ASSISTANTE gets none. Not per-module redacted for
    // COACH (would need buildStaffDiagnosticSynthesis itself to know audience
    // per field it derives from) — residual minor exposure documented in the
    // audit doc, not fixed here.
    synthesis: sessionOrError.user.role === UserRole.ASSISTANTE ? null : buildStaffDiagnosticSynthesis(diagnosticOrError),
  }, {
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
