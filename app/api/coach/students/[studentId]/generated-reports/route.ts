import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import {
  assertCoachCanAccessStudent,
  CoachNotAssignedError,
} from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { maybeCreateGeneratedReportJob } from '@/lib/reports/stage/maybeCreateGeneratedReportJob';
import { getEafCoachReportCompletion } from '@/lib/reports/stage/completeness';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const createGeneratedReportSchema = z.object({
  subject: z.enum(['FRANCAIS', 'MATHEMATIQUES']),
  kind: z.enum(['EAF_STAGE_POST', 'MATHS_PREMIERE_STAGE_POST']),
  stageSlug: z.string().min(1).max(100),
});

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

function projectGeneratedReport(report: Record<string, unknown>) {
  const {
    contextJson: _contextJson,
    llmJson: _llmJson,
    validatedJson: _validatedJson,
    latexSource: _latexSource,
    ...safeReport
  } = report;

  return safeReport;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;

    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    // Verify coach assignment
    try {
      await assertCoachCanAccessStudent({ coachUserId: authSession.user.id, studentId });
    } catch (error) {
      if (error instanceof CoachNotAssignedError) {
        return NextResponse.json(
          { error: 'Forbidden', message: "Vous n'êtes pas assigné à cet élève" },
          { status: 403 }
        );
      }
      throw error;
    }

    const reports = await prisma.generatedPedagogicalReport.findMany({
      where: {
        studentId,
      },
      orderBy: { createdAt: 'desc' },
    });

    const [studentBilan, eafReport] = await Promise.all([
      prisma.bilan.findFirst({
        where: {
          studentId,
          type: 'STAGE_POST',
          subject: 'FRANCAIS',
          sourceVersion: 'eaf_stage_printemps_v1',
          status: 'COMPLETED',
        },
        select: { id: true },
      }),
      prisma.eafPreparationReport.findFirst({
        where: { studentId },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const eafCompletion = eafReport ? getEafCoachReportCompletion(eafReport) : null;

    return NextResponse.json({
      success: true,
      reports: reports.map((report) =>
        projectGeneratedReport(report as unknown as Record<string, unknown>)
      ),
      readiness: {
        eafStagePost: {
          studentBilanReady: Boolean(studentBilan),
          coachReportValidated: Boolean(eafReport?.status === 'VALIDATED' && eafCompletion?.isComplete),
          coachCompletionRatio: eafCompletion?.completionRatio ?? 0,
          missingCoachFields: eafCompletion?.missingFields ?? [],
        },
      },
    });
  } catch (error) {
    logger.error({ err: error }, '[API] Get generated reports failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;

    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    // Verify coach assignment
    try {
      await assertCoachCanAccessStudent({ coachUserId: authSession.user.id, studentId });
    } catch (error) {
      if (error instanceof CoachNotAssignedError) {
        return NextResponse.json(
          { error: 'Forbidden', message: "Vous n'êtes pas assigné à cet élève" },
          { status: 403 }
        );
      }
      throw error;
    }

    const parseResult = createGeneratedReportSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Payload invalide.', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const jobStatus = await maybeCreateGeneratedReportJob({
      studentId,
      subject: parseResult.data.subject,
      kind: parseResult.data.kind,
      stageSlug: parseResult.data.stageSlug,
    });

    return NextResponse.json({
      success: true,
      jobStatus,
    });
  } catch (error) {
    logger.error({ err: error }, '[API] Request generated report failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
