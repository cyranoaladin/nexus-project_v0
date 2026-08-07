import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isErrorResponse, requireRole } from '@/lib/guards';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { getDiagnosticForActor, actorRole } from '@/lib/diagnostics/candidat-libre/access.server';
import { getPublicModuleDefinition } from '@/lib/diagnostics/candidat-libre/definition.public';
import { parentQuestionnaireSchema } from '@/lib/diagnostics/candidat-libre/schemas';
import { scoreDiagnosticModule, validateRequiredAnswers } from '@/lib/diagnostics/candidat-libre/scoring.server';
import type { DiagnosticAnswer } from '@/lib/diagnostics/candidat-libre/types';

interface Params { params: Promise<{ diagnosticId: string }> }
const MODULE_KEY = 'questionnaire-parent';

export async function GET(_request: Request, { params }: Params) {
  const { diagnosticId } = await params;
  const sessionOrError = await requireRole(UserRole.PARENT);
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const diagnosticOrError = await getDiagnosticForActor(sessionOrError, diagnosticId);
  if (diagnosticOrError instanceof NextResponse) return diagnosticOrError;
  const moduleRecord = diagnosticOrError.modules.find((item: any) => item.moduleKey === MODULE_KEY);
  if (!moduleRecord) return NextResponse.json({ error: 'Module not found' }, { status: 404 });
  return NextResponse.json({
    definition: getPublicModuleDefinition(MODULE_KEY),
    module: {
      status: moduleRecord.status,
      answers: moduleRecord.answers ?? {},
      currentQuestionIndex: moduleRecord.currentQuestionIndex,
      elapsedMs: moduleRecord.elapsedMs,
      submittedAt: moduleRecord.submittedAt,
    },
    student: {
      firstName: diagnosticOrError.student.user.firstName,
      lastName: diagnosticOrError.student.user.lastName,
    },
  });
}

export async function PUT(request: Request, context: Params) {
  return saveParentQuestionnaire(request, context, 'draft');
}

export async function POST(request: Request, context: Params) {
  return saveParentQuestionnaire(request, context, 'submit');
}

async function saveParentQuestionnaire(request: Request, { params }: Params, action: 'draft' | 'submit') {
  const limited = await guardRateLimitAsync(request, { preset: 'api', keySuffix: 'candidate-parent-questionnaire' });
  if (limited) return limited;
  const { diagnosticId } = await params;
  const sessionOrError = await requireRole(UserRole.PARENT);
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const diagnosticOrError = await getDiagnosticForActor(sessionOrError, diagnosticId);
  if (diagnosticOrError instanceof NextResponse) return diagnosticOrError;
  if (diagnosticOrError.submittedAt) return NextResponse.json({ error: 'Diagnostic locked' }, { status: 423 });
  const parsed = parentQuestionnaireSchema.safeParse({ ...(await request.json()), action });
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const moduleRecord = diagnosticOrError.modules.find((item: any) => item.moduleKey === MODULE_KEY);
  if (!moduleRecord) return NextResponse.json({ error: 'Module not found' }, { status: 404 });
  if (moduleRecord.submittedAt) return NextResponse.json({ error: 'Questionnaire already submitted' }, { status: 423 });
  if (moduleRecord.lastMutationId === parsed.data.clientMutationId) return NextResponse.json({ success: true, idempotent: true });

  if (action === 'submit') {
    if (!parsed.data.consent) return NextResponse.json({ error: 'Parent consent required' }, { status: 422 });
    const required = validateRequiredAnswers(MODULE_KEY, parsed.data.answers as Record<string, DiagnosticAnswer>);
    if (!required.valid) return NextResponse.json({ error: 'Incomplete questionnaire', missingQuestionIds: required.missingQuestionIds }, { status: 422 });
  }
  const score = action === 'submit' ? scoreDiagnosticModule(MODULE_KEY, parsed.data.answers as Record<string, DiagnosticAnswer>) : null;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.candidateDiagnosticModule.update({
      where: { id: moduleRecord.id },
      data: {
        answers: parsed.data.answers as unknown as Prisma.InputJsonValue,
        currentQuestionIndex: Object.keys(parsed.data.answers).length,
        autoScore: score as unknown as Prisma.InputJsonValue | undefined,
        status: action === 'submit' ? (score?.manualReviewQuestionIds.length ? 'NEEDS_REVIEW' : 'AUTO_SCORED') : 'IN_PROGRESS',
        startedAt: moduleRecord.startedAt ?? now,
        submittedAt: action === 'submit' ? now : undefined,
        lastMutationId: parsed.data.clientMutationId,
      },
    });
    if (action === 'submit') {
      await tx.candidateDiagnostic.update({
        where: { id: diagnosticId },
        data: { parentConsentAt: now, parentSubmittedAt: now },
      });
    }
    await tx.candidateDiagnosticAuditLog.create({
      data: {
        diagnosticId,
        actorId: sessionOrError.user.id,
        actorRole: actorRole(sessionOrError),
        action: action === 'submit' ? 'PARENT_QUESTIONNAIRE_SUBMITTED' : 'PARENT_QUESTIONNAIRE_AUTOSAVED',
        entityType: 'CandidateDiagnosticModule',
        entityId: moduleRecord.id,
      },
    });
  });
  return NextResponse.json({ success: true, status: action === 'submit' ? 'SUBMITTED' : 'DRAFT' });
}
