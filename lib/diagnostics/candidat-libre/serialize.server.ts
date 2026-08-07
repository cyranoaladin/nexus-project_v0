import 'server-only';

import type { UserRole } from '@prisma/client';
import { computeCompletionPercentage } from './progression';
import { canViewModuleDetail, isDocumentVisibleToViewer } from './access.server';
import type { DiagnosticCampaignView, DiagnosticModuleView } from './types';

/**
 * viewerRole scopes cross-audience module detail — a diagnostic has both
 * ELEVE and PARENT modules, and this serializer backs the shared GET/PATCH
 * routes every role calls. Detail visibility (autoScore/reviewSummary) is
 * delegated to canViewModuleDetail (access.server.ts), the single source of
 * truth for this rule shared with modules/[moduleKey] and staff-export —
 * do not re-implement the matrix here. completion status/progress stay
 * visible regardless of role (the UI needs "waiting on parent" states).
 * No role (internal callers) sees everything, same as before.
 */
export function serializeCandidateDiagnostic(
  diagnostic: any,
  viewerRole?: UserRole,
): DiagnosticCampaignView {
  const modules: DiagnosticModuleView[] = diagnostic.modules.map((module: any) => {
    const canViewDetail = !viewerRole || canViewModuleDetail(viewerRole, module.audience);
    return {
      key: module.moduleKey,
      status: module.status,
      progress: module.status === 'REVIEWED' ? 100 : module.submittedAt ? 100 : Math.min(99, Math.max(0, Math.round(((module.currentQuestionIndex ?? 0) / Math.max(1, module.definitionSnapshot?.questions?.length ?? 1)) * 100))),
      startedAt: module.startedAt?.toISOString?.() ?? module.startedAt ?? null,
      submittedAt: module.submittedAt?.toISOString?.() ?? module.submittedAt ?? null,
      availableAt: module.availableAt?.toISOString?.() ?? module.availableAt ?? null,
      elapsedMs: module.elapsedMs,
      autoScore: canViewDetail ? module.autoScore ?? null : null,
      reviewSummary: canViewDetail ? module.reviewSummary ?? null : null,
    };
  });

  return {
    id: diagnostic.id,
    diagnosticKey: diagnostic.diagnosticKey,
    definitionVersion: diagnostic.definitionVersion,
    status: diagnostic.status,
    targetSession: diagnostic.targetSession,
    student: {
      id: diagnostic.student.id,
      firstName: diagnostic.student.user.firstName,
      lastName: diagnostic.student.user.lastName,
      email: diagnostic.student.user.email,
      school: diagnostic.student.school,
      gradeLevel: diagnostic.student.gradeLevel,
    },
    modules,
    documents: diagnostic.documents
      .filter((document: any) => !viewerRole || isDocumentVisibleToViewer(document.category, viewerRole))
      .map((document: any) => ({
        id: document.id,
        category: document.category,
        originalName: document.originalName,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        status: document.status,
        reviewNote: document.reviewNote,
        createdAt: document.createdAt?.toISOString?.() ?? document.createdAt,
        downloadUrl: `/api/diagnostics/candidat-libre/${diagnostic.id}/documents/${document.id}`,
      })),
    completionPercentage: computeCompletionPercentage(modules),
    studentConsentAt: diagnostic.studentConsentAt?.toISOString?.() ?? diagnostic.studentConsentAt ?? null,
    parentConsentAt: diagnostic.parentConsentAt?.toISOString?.() ?? diagnostic.parentConsentAt ?? null,
    submittedAt: diagnostic.submittedAt?.toISOString?.() ?? diagnostic.submittedAt ?? null,
    retentionDueAt: diagnostic.retentionDueAt?.toISOString?.() ?? diagnostic.retentionDueAt ?? null,
    createdAt: diagnostic.createdAt.toISOString(),
    updatedAt: diagnostic.updatedAt.toISOString(),
  };
}
