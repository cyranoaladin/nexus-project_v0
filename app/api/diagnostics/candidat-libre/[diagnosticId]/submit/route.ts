import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isErrorResponse, requireRole } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getDiagnosticForActor, actorRole } from '@/lib/diagnostics/candidat-libre/access.server';
import { CANDIDATE_DIAGNOSTIC_MODULES } from '@/lib/diagnostics/candidat-libre/definition.public';
import { isModuleComplete } from '@/lib/diagnostics/candidat-libre/progression';
import { guardCandidateDiagnosticFeature } from '@/lib/diagnostics/candidat-libre/feature-flag';

interface Params { params: Promise<{ diagnosticId: string }> }

export async function POST(request: Request, { params }: Params) {
  const disabled = guardCandidateDiagnosticFeature();
  if (disabled) return disabled;
  const ipLimited = await guardSensitiveRateLimit(request, { scope: 'candidate-diagnostic-final-submit', dimensions: ['ip'] });
  if (ipLimited) return ipLimited;
  const { diagnosticId } = await params;
  const sessionOrError = await requireRole(UserRole.ELEVE);
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const identityLimited = await guardSensitiveRateLimit(request, {
    scope: 'candidate-diagnostic-final-submit',
    identity: sessionOrError.user.id,
    dimensions: ['identity'],
  });
  if (identityLimited) return identityLimited;
  const diagnosticOrError = await getDiagnosticForActor(sessionOrError, diagnosticId);
  if (diagnosticOrError instanceof NextResponse) return diagnosticOrError;
  if (diagnosticOrError.submittedAt) return NextResponse.json({ success: true, idempotent: true, status: diagnosticOrError.status });

  const body = await request.json().catch(() => ({}));
  if (body.confirm !== true) return NextResponse.json({ error: 'Explicit confirmation required' }, { status: 422 });
  if (!diagnosticOrError.studentConsentAt) return NextResponse.json({ error: 'Student consent missing' }, { status: 422 });
  if (!diagnosticOrError.parentConsentAt || !diagnosticOrError.parentSubmittedAt) {
    return NextResponse.json({ error: 'Parent questionnaire missing' }, { status: 422 });
  }

  const byKey = new Map(diagnosticOrError.modules.map((module: any) => [module.moduleKey, module]));
  const required = CANDIDATE_DIAGNOSTIC_MODULES.filter((module) => module.requiredForSubmission);
  const incomplete = required.filter((definition) => {
    const moduleRecord = byKey.get(definition.key) as any;
    return !moduleRecord || !isModuleComplete(moduleRecord.status);
  }).map((module) => module.key);
  if (incomplete.length > 0) return NextResponse.json({ error: 'Incomplete diagnostic', incompleteModuleKeys: incomplete }, { status: 422 });

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.candidateDiagnostic.update({
      where: { id: diagnosticId },
      data: { status: 'IN_REVIEW', submittedAt: now },
    });
    await tx.candidateDiagnosticAuditLog.create({
      data: {
        diagnosticId,
        actorId: sessionOrError.user.id,
        actorRole: actorRole(sessionOrError),
        action: 'DIAGNOSTIC_FINAL_SUBMISSION',
        entityType: 'CandidateDiagnostic',
        entityId: diagnosticId,
        details: { moduleCount: required.length, documentCount: diagnosticOrError.documents.length },
      },
    });
  });

  return NextResponse.json({ success: true, status: 'IN_REVIEW', submittedAt: now.toISOString() });
}
