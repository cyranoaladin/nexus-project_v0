import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import {
  assertCoachCanAccessStudent,
  getCoachProfileForUser,
  CoachNotAssignedError,
} from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getEafCoachReportCompletion } from '@/lib/reports/stage/completeness';

const MAX_FIELD_LENGTH = 5000;

// Schema for EAF preparation report
const eafPreparationReportSchema = z.object({
  linearReading: z.string().max(MAX_FIELD_LENGTH).optional(),
  workPresentation: z.string().max(MAX_FIELD_LENGTH).optional(),
  interview: z.string().max(MAX_FIELD_LENGTH).optional(),
  oralExpression: z.string().max(MAX_FIELD_LENGTH).optional(),
  writingMethod: z.string().max(MAX_FIELD_LENGTH).optional(),
  languageMastery: z.string().max(MAX_FIELD_LENGTH).optional(),
  literaryCulture: z.string().max(MAX_FIELD_LENGTH).optional(),
  strengths: z.string().max(MAX_FIELD_LENGTH).optional(),
  areasToImprove: z.string().max(MAX_FIELD_LENGTH).optional(),
  nextSessionGoals: z.string().max(MAX_FIELD_LENGTH).optional(),
  coachFreeComment: z.string().max(MAX_FIELD_LENGTH).optional(),
});

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

/**
 * GET /api/coach/students/[studentId]/eaf-preparation-report
 * Returns the EAF preparation report for a student (if exists)
 */
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

    const coachProfile = await getCoachProfileForUser(authSession.user.id);
    if (!coachProfile) {
      return NextResponse.json({ error: 'Coach profile not found' }, { status: 404 });
    }

    // Get EAF preparation report
    const report = await prisma.eafPreparationReport.findUnique({
      where: {
        studentId_coachId: {
          studentId,
          coachId: coachProfile.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    logger.error({ err: error }, '[API] coach/students/[studentId]/eaf-preparation-report GET failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/students/[studentId]/eaf-preparation-report
 * Create or update the EAF preparation report
 */
export async function PUT(request: Request, { params }: RouteParams) {
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

    const coachProfile = await getCoachProfileForUser(authSession.user.id);
    if (!coachProfile) {
      return NextResponse.json({ error: 'Coach profile not found' }, { status: 404 });
    }

    const json = await request.json();
    const parseResult = eafPreparationReportSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Validation échouée', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const completion = getEafCoachReportCompletion(data);

    // Build Prisma-compatible data object
    const reportData = {
      linearReading: data.linearReading ?? null,
      workPresentation: data.workPresentation ?? null,
      interview: data.interview ?? null,
      oralExpression: data.oralExpression ?? null,
      writingMethod: data.writingMethod ?? null,
      languageMastery: data.languageMastery ?? null,
      literaryCulture: data.literaryCulture ?? null,
      strengths: data.strengths ?? null,
      areasToImprove: data.areasToImprove ?? null,
      nextSessionGoals: data.nextSessionGoals ?? null,
      coachFreeComment: data.coachFreeComment ?? null,
    };

    // Upsert the report
    const report = await prisma.eafPreparationReport.upsert({
      where: {
        studentId_coachId: {
          studentId,
          coachId: coachProfile.id,
        },
      },
      update: {
        ...reportData,
        status: 'DRAFT',
        completionRatio: completion.completionRatio,
        validatedAt: null,
        validatedBy: null,
      },
      create: {
        studentId,
        coachId: coachProfile.id,
        ...reportData,
        status: 'DRAFT',
        completionRatio: completion.completionRatio,
      },
    });

    logger.info(
      { reportId: report.id, studentId, coachId: coachProfile.id },
      '[API] coach/students/[studentId]/eaf-preparation-report saved'
    );

    return NextResponse.json({ success: true, report });
  } catch (error) {
    logger.error({ err: error }, '[API] coach/students/[studentId]/eaf-preparation-report PUT failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
