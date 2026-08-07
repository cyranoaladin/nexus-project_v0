import { NextResponse } from 'next/server';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { isErrorResponse } from '@/lib/guards';
import { CANDIDATE_DIAGNOSTIC_MODULES } from '@/lib/diagnostics/candidat-libre/definition.public';
import { createDiagnosticSchema } from '@/lib/diagnostics/candidat-libre/schemas';
import { DIAGNOSTIC_KEY, DIAGNOSTIC_VERSION } from '@/lib/diagnostics/candidat-libre/types';
import { getStudentForActor, requireDiagnosticActor, actorRole } from '@/lib/diagnostics/candidat-libre/access.server';
import { serializeCandidateDiagnostic } from '@/lib/diagnostics/candidat-libre/serialize.server';
import { guardCandidateDiagnosticFeature } from '@/lib/diagnostics/candidat-libre/feature-flag';

export async function GET(request: Request) {
  const disabled = guardCandidateDiagnosticFeature();
  if (disabled) return disabled;
  const sessionOrError = await requireDiagnosticActor();
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  const url = new URL(request.url);
  const studentId = url.searchParams.get('studentId') ?? undefined;
  const targetSession = Number(url.searchParams.get('targetSession') ?? 2027);
  const studentOrError = await getStudentForActor(sessionOrError, studentId);
  if (studentOrError instanceof NextResponse) return studentOrError;
  if (!studentOrError) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const diagnostic = await prisma.candidateDiagnostic.findUnique({
    where: {
      studentId_diagnosticKey_targetSession: {
        studentId: studentOrError.id,
        diagnosticKey: DIAGNOSTIC_KEY,
        targetSession,
      },
    },
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      modules: { orderBy: { createdAt: 'asc' } },
      documents: { orderBy: { createdAt: 'desc' } },
    },
  });
  return NextResponse.json({ diagnostic: diagnostic ? serializeCandidateDiagnostic(diagnostic, actorRole(sessionOrError)) : null });
}

export async function POST(request: Request) {
  const disabled = guardCandidateDiagnosticFeature();
  if (disabled) return disabled;
  const limited = await guardRateLimitAsync(request, { preset: 'api', keySuffix: 'candidate-diagnostic-create' });
  if (limited) return limited;
  const sessionOrError = await requireDiagnosticActor();
  if (isErrorResponse(sessionOrError)) return sessionOrError;
  if (!([UserRole.ELEVE, UserRole.PARENT, UserRole.ADMIN, UserRole.ASSISTANTE] as UserRole[]).includes(sessionOrError.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = createDiagnosticSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const studentOrError = await getStudentForActor(sessionOrError, parsed.data.studentId);
  if (studentOrError instanceof NextResponse) return studentOrError;
  if (!studentOrError) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const diagnostic = await prisma.$transaction(async (tx) => {
    const existing = await tx.candidateDiagnostic.findUnique({
      where: {
        studentId_diagnosticKey_targetSession: {
          studentId: studentOrError.id,
          diagnosticKey: DIAGNOSTIC_KEY,
          targetSession: parsed.data.targetSession,
        },
      },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        modules: { orderBy: { createdAt: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (existing) return existing;

    return tx.candidateDiagnostic.create({
      data: {
        diagnosticKey: DIAGNOSTIC_KEY,
        definitionVersion: DIAGNOSTIC_VERSION,
        targetSession: parsed.data.targetSession,
        status: 'ACTIVE',
        studentId: studentOrError.id,
        createdById: sessionOrError.user.id,
        metadata: { source: parsed.data.source } as Prisma.InputJsonValue,
        modules: {
          create: CANDIDATE_DIAGNOSTIC_MODULES.map((module) => ({
            moduleKey: module.key,
            audience: module.audience,
            status: module.key === 'accueil-integrite' || module.key === 'questionnaire-parent' ? 'AVAILABLE' : 'LOCKED',
            definitionSnapshot: JSON.parse(JSON.stringify(module)) as Prisma.InputJsonValue,
          })),
        },
        audits: {
          create: {
            actorId: sessionOrError.user.id,
            actorRole: sessionOrError.user.role === UserRole.PARENT ? 'PARENT' : sessionOrError.user.role === UserRole.ELEVE ? 'ELEVE' : 'ADMIN',
            action: 'DIAGNOSTIC_CREATED',
            entityType: 'CandidateDiagnostic',
            details: { source: parsed.data.source } as Prisma.InputJsonValue,
          },
        },
      },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        modules: { orderBy: { createdAt: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });
  });

  return NextResponse.json({ diagnostic: serializeCandidateDiagnostic(diagnostic, actorRole(sessionOrError)) }, { status: 201 });
}
