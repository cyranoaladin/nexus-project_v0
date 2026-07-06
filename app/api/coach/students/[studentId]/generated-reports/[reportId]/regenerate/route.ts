import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import {
  assertCoachCanAccessStudent,
  CoachNotAssignedError,
} from '@/lib/rbac/coach-student-access';
import { processGeneratedReportJob } from '@/lib/reports/stage/processGeneratedReportJob';
import { logger } from '@/lib/logger';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ studentId: string; reportId: string }>;
}

const routeParamsSchema = z.object({
  studentId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/),
  reportId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/),
}).strict();

function validationFailed() {
  return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
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
    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) return validationFailed();
    const { studentId, reportId } = parsedParams.data;

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
