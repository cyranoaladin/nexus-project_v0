import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isErrorResponse, requireRole } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getDiagnosticForActor, actorRole } from '@/lib/diagnostics/candidat-libre/access.server';
import { isModuleComplete } from '@/lib/diagnostics/candidat-libre/progression';
import { requireVerifiedParentalConsent } from '@/lib/diagnostics/candidat-libre/consent-gate.server';
import { isStudentAdultAt, requiredModuleKeysForDossier } from '@/lib/diagnostics/candidat-libre/module-scoping';
import { noteStudentActivity } from '@/lib/rgpd/last-activity.server';
import { guardCandidateDiagnosticFeature, guardCandidateDiagnosticForStudent } from '@/lib/diagnostics/candidat-libre/feature-flag';

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
  // Hors allowlist, le dossier doit paraitre absent : 404 avant tout autre verdict.
  const notAllowed = guardCandidateDiagnosticForStudent(diagnosticOrError.studentId);
  if (notAllowed) return notAllowed;

  // Dossier portant sur un mineur : aucune collecte avant consentement parental verifie.
  const consentBlocked = await requireVerifiedParentalConsent(diagnosticOrError.studentId);
  if (consentBlocked) return consentBlocked;
  if (diagnosticOrError.submittedAt) return NextResponse.json({ success: true, idempotent: true, status: diagnosticOrError.status });

  const body = await request.json().catch(() => ({}));
  if (body.confirm !== true) return NextResponse.json({ error: 'Explicit confirmation required' }, { status: 422 });
  if (!diagnosticOrError.studentConsentAt) return NextResponse.json({ error: 'Student consent missing' }, { status: 422 });
  if (!diagnosticOrError.parentConsentAt || !diagnosticOrError.parentSubmittedAt) {
    return NextResponse.json({ error: 'Parent questionnaire missing' }, { status: 422 });
  }

  const byKey = new Map(diagnosticOrError.modules.map((module: any) => [module.moduleKey, module]));
  // Le questionnaire parent n'est pas exigé d'un étudiant majeur : il recueille
  // l'avis d'une autorité parentale qui n'existe plus.
  const studentIsAdult = isStudentAdultAt(diagnosticOrError.student?.birthDate ?? null, new Date());
  const required = requiredModuleKeysForDossier({ studentIsAdult });
  const incomplete = required.filter((key) => {
    const moduleRecord = byKey.get(key) as any;
    return !moduleRecord || !isModuleComplete(moduleRecord.status);
  });
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

  await noteStudentActivity({
    diagnosticId, activity: 'DOSSIER_SOUMIS', actorRole: sessionOrError.user.role,
  });
  return NextResponse.json({ success: true, status: 'IN_REVIEW', submittedAt: now.toISOString() });
}
