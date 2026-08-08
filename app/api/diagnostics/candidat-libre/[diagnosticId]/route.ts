import { NextResponse } from 'next/server';
import { isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { getDiagnosticForActor, requireDiagnosticActor, actorRole } from '@/lib/diagnostics/candidat-libre/access.server';
import { updateDiagnosticProfileSchema } from '@/lib/diagnostics/candidat-libre/schemas';
import { serializeCandidateDiagnostic } from '@/lib/diagnostics/candidat-libre/serialize.server';
import { requireVerifiedParentalConsent } from '@/lib/diagnostics/candidat-libre/consent-gate.server';
import { guardCandidateDiagnosticFeature, guardCandidateDiagnosticForStudent } from '@/lib/diagnostics/candidat-libre/feature-flag';
import type { Prisma } from '@prisma/client';

interface Params { params: Promise<{ diagnosticId: string }> }

export async function GET(_request: Request, { params }: Params) {
  const disabled = guardCandidateDiagnosticFeature();
  if (disabled) return disabled;
  const { diagnosticId } = await params;
  const sessionOrError = await requireDiagnosticActor();
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const diagnosticOrError = await getDiagnosticForActor(sessionOrError, diagnosticId);
  if (diagnosticOrError instanceof NextResponse) return diagnosticOrError;
  return NextResponse.json({ diagnostic: serializeCandidateDiagnostic(diagnosticOrError, sessionOrError.user.role) });
}

export async function PATCH(request: Request, { params }: Params) {
  const disabled = guardCandidateDiagnosticFeature();
  if (disabled) return disabled;
  const { diagnosticId } = await params;
  const sessionOrError = await requireDiagnosticActor();
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const diagnosticOrError = await getDiagnosticForActor(sessionOrError, diagnosticId);
  if (diagnosticOrError instanceof NextResponse) return diagnosticOrError;
  // Hors allowlist, le dossier doit paraitre absent : 404 avant tout autre verdict.
  const notAllowed = guardCandidateDiagnosticForStudent(diagnosticOrError.studentId);
  if (notAllowed) return notAllowed;

  // Dossier portant sur un mineur : aucune collecte avant consentement parental verifie.
  const consentBlocked = await requireVerifiedParentalConsent(diagnosticOrError.studentId);
  if (consentBlocked) return consentBlocked;
  if (diagnosticOrError.submittedAt) return NextResponse.json({ error: 'Locked' }, { status: 423 });

  const parsed = updateDiagnosticProfileSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.candidateDiagnostic.update({
      where: { id: diagnosticId },
      data: {
        targetSession: parsed.data.targetSession,
        studentConsentAt: parsed.data.studentConsent === true ? new Date() : undefined,
        metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    await tx.candidateDiagnosticAuditLog.create({
      data: {
        diagnosticId,
        actorId: sessionOrError.user.id,
        actorRole: actorRole(sessionOrError),
        action: 'DIAGNOSTIC_METADATA_UPDATED',
        entityType: 'CandidateDiagnostic',
        entityId: diagnosticId,
      },
    });
    return tx.candidateDiagnostic.findUniqueOrThrow({
      where: { id: diagnosticId },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        modules: { orderBy: { createdAt: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });
  });
  return NextResponse.json({ diagnostic: serializeCandidateDiagnostic(updated, sessionOrError.user.role) });
}
