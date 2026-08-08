import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isErrorResponse } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import type { SensitiveRateLimitScope } from '@/lib/rate-limit/sensitive';
import { canViewModuleDetail, getDiagnosticForActor, requireDiagnosticActor, actorRole } from '@/lib/diagnostics/candidat-libre/access.server';
import { getPublicModuleDefinition, CANDIDATE_DIAGNOSTIC_MODULES } from '@/lib/diagnostics/candidat-libre/definition.public';
import { moduleDraftSchema, moduleKeySchema } from '@/lib/diagnostics/candidat-libre/schemas';
import { scoreDiagnosticModule, validateRequiredAnswers } from '@/lib/diagnostics/candidat-libre/scoring.server';
import { resolveModuleAvailability } from '@/lib/diagnostics/candidat-libre/progression';
import { requireVerifiedParentalConsent } from '@/lib/diagnostics/candidat-libre/consent-gate.server';
import { guardCandidateDiagnosticFeature, guardCandidateDiagnosticForStudent } from '@/lib/diagnostics/candidat-libre/feature-flag';
import type { DiagnosticAnswer, DiagnosticModuleView } from '@/lib/diagnostics/candidat-libre/types';

interface Params { params: Promise<{ diagnosticId: string; moduleKey: string }> }

// WRITE permission only — who may submit/save answers for this module.
// Distinct from READ visibility (canViewModuleDetail, access.server.ts):
// conflating the two previously produced a false parallel (a COACH blocked
// from editing was wrongly assumed blocked from reading too). This function
// still governs edit gating below (PUT/POST) and the 403 on GET; the GET
// response's `answers` field now uses canViewModuleDetail instead (see
// below) — a COACH can read an ELEVE-audience module's answers without
// being able to edit them.
//
// Known residual inconsistency, not fixed here (flagged, not routed
// around): ASSISTANTE returns true unconditionally, same as ADMIN — she can
// still WRITE any module's answers even though canViewModuleDetail now
// denies her READ access to that same content. Product decision needed:
// either ASSISTANTE never had a real reason to write academic answers
// either (tighten this function), or her write access is intentional
// (e.g. transcribing on behalf of family) and only read is restricted.
function canEditAudience(role: UserRole, audience: string) {
  if (role === UserRole.ELEVE) return audience === 'ELEVE';
  if (role === UserRole.PARENT) return audience === 'PARENT';
  return role === UserRole.ADMIN || role === UserRole.ASSISTANTE;
}

function moduleViews(diagnostic: any): DiagnosticModuleView[] {
  return diagnostic.modules.map((module: any) => ({
    key: module.moduleKey,
    status: module.status,
    progress: module.submittedAt ? 100 : 0,
    submittedAt: module.submittedAt?.toISOString?.() ?? null,
    availableAt: module.availableAt?.toISOString?.() ?? null,
  }));
}

export async function GET(_request: Request, { params }: Params) {
  const disabled = guardCandidateDiagnosticFeature();
  if (disabled) return disabled;
  const { diagnosticId, moduleKey: rawModuleKey } = await params;
  const parsedKey = moduleKeySchema.safeParse(rawModuleKey);
  if (!parsedKey.success) return NextResponse.json({ error: 'Invalid module key' }, { status: 400 });
  const definition = getPublicModuleDefinition(parsedKey.data);
  if (!definition) return NextResponse.json({ error: 'Module not found' }, { status: 404 });

  const sessionOrError = await requireDiagnosticActor();
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const diagnosticOrError = await getDiagnosticForActor(sessionOrError, diagnosticId);
  if (diagnosticOrError instanceof NextResponse) return diagnosticOrError;
  if (!canEditAudience(sessionOrError.user.role, definition.audience) && sessionOrError.user.role !== UserRole.COACH) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const moduleRecord = diagnosticOrError.modules.find((item: any) => item.moduleKey === parsedKey.data);
  if (!moduleRecord) return NextResponse.json({ error: 'Module record not found' }, { status: 404 });
  const availability = resolveModuleAvailability(parsedKey.data, moduleViews(diagnosticOrError));

  return NextResponse.json({
    definition,
    module: {
      key: moduleRecord.moduleKey,
      status: moduleRecord.status,
      answers: canViewModuleDetail(sessionOrError.user.role, definition.audience) ? moduleRecord.answers ?? {} : undefined,
      currentQuestionIndex: moduleRecord.currentQuestionIndex,
      elapsedMs: moduleRecord.elapsedMs,
      integrity: moduleRecord.integrity,
      submittedAt: moduleRecord.submittedAt,
      availableAt: availability.availableAt,
      availability,
    },
  });
}

export async function PUT(request: Request, context: Params) {
  return saveModule(request, context, 'draft');
}

export async function POST(request: Request, context: Params) {
  return saveModule(request, context, 'submit');
}

async function saveModule(request: Request, { params }: Params, forcedAction: 'draft' | 'submit') {
  const disabled = guardCandidateDiagnosticFeature();
  if (disabled) return disabled;
  const scope: SensitiveRateLimitScope = forcedAction === 'submit' ? 'candidate-module-submit' : 'candidate-module-draft';
  const ipLimited = await guardSensitiveRateLimit(request, { scope, dimensions: ['ip'] });
  if (ipLimited) return ipLimited;
  const { diagnosticId, moduleKey: rawModuleKey } = await params;
  const parsedKey = moduleKeySchema.safeParse(rawModuleKey);
  if (!parsedKey.success) return NextResponse.json({ error: 'Invalid module key' }, { status: 400 });
  const definition = getPublicModuleDefinition(parsedKey.data);
  if (!definition) return NextResponse.json({ error: 'Module not found' }, { status: 404 });

  const sessionOrError = await requireDiagnosticActor();
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const identityLimited = await guardSensitiveRateLimit(request, { scope, identity: sessionOrError.user.id, dimensions: ['identity'] });
  if (identityLimited) return identityLimited;
  if (!canEditAudience(sessionOrError.user.role, definition.audience)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const diagnosticOrError = await getDiagnosticForActor(sessionOrError, diagnosticId);
  if (diagnosticOrError instanceof NextResponse) return diagnosticOrError;
  // Hors allowlist, le dossier doit paraitre absent : 404 avant tout autre verdict.
  const notAllowed = guardCandidateDiagnosticForStudent(diagnosticOrError.studentId);
  if (notAllowed) return notAllowed;

  // Dossier portant sur un mineur : aucune collecte avant consentement parental verifie.
  const consentBlocked = await requireVerifiedParentalConsent(diagnosticOrError.studentId);
  if (consentBlocked) return consentBlocked;
  if (diagnosticOrError.submittedAt) return NextResponse.json({ error: 'Diagnostic locked' }, { status: 423 });

  const parsed = moduleDraftSchema.safeParse({ ...(await request.json()), action: forcedAction });
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const moduleRecord = diagnosticOrError.modules.find((item: any) => item.moduleKey === parsedKey.data);
  if (!moduleRecord) return NextResponse.json({ error: 'Module record not found' }, { status: 404 });
  if (moduleRecord.submittedAt) return NextResponse.json({ error: 'Module locked after submission' }, { status: 423 });
  if (moduleRecord.lastMutationId === parsed.data.clientMutationId) return NextResponse.json({ success: true, idempotent: true, module: moduleRecord });

  const availability = resolveModuleAvailability(parsedKey.data, moduleViews(diagnosticOrError));
  if (!availability.available) {
    return NextResponse.json({ error: 'Module locked', availableAt: availability.availableAt, reason: availability.reason }, { status: 423 });
  }

  if (forcedAction === 'submit') {
    const required = validateRequiredAnswers(parsedKey.data, parsed.data.answers as Record<string, DiagnosticAnswer>);
    if (!required.valid) return NextResponse.json({ error: 'Incomplete module', missingQuestionIds: required.missingQuestionIds }, { status: 422 });
    const requiredUploads = definition.questions.filter((question) => question.type === 'upload' && question.uploadRule?.required);
    for (const question of requiredUploads) {
      const count = diagnosticOrError.documents.filter((document: any) => document.category === question.uploadRule?.category && document.status !== 'REJECTED').length;
      if (count < 1) return NextResponse.json({ error: 'Missing required document', questionId: question.id, category: question.uploadRule?.category }, { status: 422 });
    }
  }

  const score = forcedAction === 'submit'
    ? scoreDiagnosticModule(parsedKey.data, parsed.data.answers as Record<string, DiagnosticAnswer>)
    : null;
  const now = new Date();
  const newStatus = forcedAction === 'submit'
    ? score && score.manualReviewQuestionIds.length > 0 ? 'NEEDS_REVIEW' : 'AUTO_SCORED'
    : moduleRecord.status === 'AVAILABLE' ? 'IN_PROGRESS' : moduleRecord.status;

  const result = await prisma.$transaction(async (tx) => {
    await tx.candidateDiagnosticModule.update({
      where: { id: moduleRecord.id },
      data: {
        answers: parsed.data.answers as unknown as Prisma.InputJsonValue,
        currentQuestionIndex: parsed.data.currentQuestionIndex,
        elapsedMs: parsed.data.elapsedMs,
        integrity: parsed.data.integrity as unknown as Prisma.InputJsonValue,
        autoScore: score as unknown as Prisma.InputJsonValue | undefined,
        status: newStatus,
        startedAt: moduleRecord.startedAt ?? now,
        submittedAt: forcedAction === 'submit' ? now : undefined,
        lastMutationId: parsed.data.clientMutationId,
      },
    });

    const unlocked: string[] = [];
    if (forcedAction === 'submit') {
      if (parsedKey.data === 'accueil-integrite') {
        await tx.candidateDiagnostic.update({
          where: { id: diagnosticId },
          data: { studentConsentAt: now, status: 'ACTIVE' },
        });
      }
      const updatedViews = moduleViews(diagnosticOrError).map((view) => view.key === parsedKey.data ? { ...view, status: newStatus as any, submittedAt: now.toISOString() } : view);
      for (const candidate of CANDIDATE_DIAGNOSTIC_MODULES) {
        if (candidate.audience !== definition.audience) continue;
        const record = diagnosticOrError.modules.find((item: any) => item.moduleKey === candidate.key);
        if (!record || record.status !== 'LOCKED') continue;
        const nextAvailability = resolveModuleAvailability(candidate.key, updatedViews, now);
        if (nextAvailability.available || nextAvailability.availableAt) {
          await tx.candidateDiagnosticModule.update({
            where: { id: record.id },
            data: {
              status: nextAvailability.available ? 'AVAILABLE' : 'LOCKED',
              availableAt: nextAvailability.availableAt,
            },
          });
          if (nextAvailability.available) unlocked.push(candidate.key);
          if (candidate.key === 'retention-transfert' && nextAvailability.availableAt) {
            await tx.candidateDiagnostic.update({ where: { id: diagnosticId }, data: { retentionDueAt: nextAvailability.availableAt, status: 'WAITING_RETENTION' } });
          }
        }
      }
    }

    await tx.candidateDiagnosticAuditLog.create({
      data: {
        diagnosticId,
        actorId: sessionOrError.user.id,
        actorRole: actorRole(sessionOrError),
        action: forcedAction === 'submit' ? 'MODULE_SUBMITTED' : 'MODULE_AUTOSAVED',
        entityType: 'CandidateDiagnosticModule',
        entityId: moduleRecord.id,
        details: forcedAction === 'submit' ? { moduleKey: parsedKey.data, elapsedMs: parsed.data.elapsedMs } : undefined,
      },
    });

    const updated = await tx.candidateDiagnosticModule.findUniqueOrThrow({ where: { id: moduleRecord.id } });
    return { updated, unlocked };
  });

  return NextResponse.json({
    success: true,
    module: {
      key: result.updated.moduleKey,
      status: result.updated.status,
      submittedAt: result.updated.submittedAt,
      progress: forcedAction === 'submit' ? 100 : Math.round(((parsed.data.currentQuestionIndex + 1) / definition.questions.length) * 100),
    },
    unlockedModuleKeys: result.unlocked,
  });
}
