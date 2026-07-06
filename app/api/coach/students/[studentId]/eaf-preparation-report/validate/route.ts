import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import {
  assertCoachCanAccessStudent,
  getCoachProfileForUser,
  CoachNotAssignedError,
} from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { maybeCreateGeneratedReportJob } from '@/lib/reports/stage/maybeCreateGeneratedReportJob';
import { getEafCoachReportCompletion } from '@/lib/reports/stage/completeness';
import { logger } from '@/lib/logger';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

const routeParamsSchema = z.object({
  studentId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/),
}).strict();

function validationFailed() {
  return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) return validationFailed();
    const { studentId } = parsedParams.data;

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

    const coachProfile = await getCoachProfileForUser(authSession.user.id);
    if (!coachProfile) {
      return NextResponse.json({ error: 'Coach profile not found' }, { status: 404 });
    }

    const existingReport = await prisma.eafPreparationReport.findUnique({
      where: {
        studentId_coachId: {
          studentId,
          coachId: coachProfile.id,
        },
      },
    });

    if (!existingReport) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Aucun bilan coach EAF à valider.' },
        { status: 404 }
      );
    }

    const completion = getEafCoachReportCompletion(existingReport);
    if (!completion.isComplete) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Le bilan coach EAF est incomplet.',
          completionRatio: completion.completionRatio,
          missingFields: completion.missingFields,
        },
        { status: 400 }
      );
    }

    // Update EAF preparation report status to VALIDATED
    const report = await prisma.eafPreparationReport.update({
      where: {
        studentId_coachId: {
          studentId,
          coachId: coachProfile.id,
        },
      },
      data: {
        status: 'VALIDATED',
        completionRatio: completion.completionRatio,
        validatedAt: new Date(),
        validatedBy: coachProfile.id,
      },
    });

    // Check if the report can now be created
    const jobStatus = await maybeCreateGeneratedReportJob({
      studentId,
      subject: 'FRANCAIS',
      kind: 'EAF_STAGE_POST',
      stageSlug: 'stage-printemps-2026',
    });

    return NextResponse.json({
      success: true,
      report,
      jobStatus,
    });
  } catch (error) {
    logger.error({ err: error }, '[API] Validate EAF report failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
