import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import {
  assertCoachCanAccessStudent,
  CoachNotAssignedError,
} from '@/lib/rbac/coach-student-access';
import { processGeneratedReportJob } from '@/lib/reports/stage/processGeneratedReportJob';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ studentId: string; reportId: string }>;
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

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { studentId, reportId } = await params;

    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    try {
      await assertCoachCanAccessStudent({ coachUserId: authSession.user.id, studentId });
    } catch (error) {
      if (error instanceof CoachNotAssignedError) {
        return NextResponse.json(
          { error: 'Forbidden', message: "Vous n'êtes pas assigné à cet élève" },
          { status: 403 },
        );
      }
      throw error;
    }

    const result = await processGeneratedReportJob({ studentId, reportId });
    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      report: projectGeneratedReport(result.report as unknown as Record<string, unknown>),
    });
  } catch (error) {
    logger.error({ err: error }, '[API] Regenerate generated report failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
