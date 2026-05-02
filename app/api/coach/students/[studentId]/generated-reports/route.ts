import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import {
  assertCoachCanAccessStudent,
  getCoachProfileForUser,
  CoachNotAssignedError,
} from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { maybeCreateGeneratedReportJob } from '@/lib/reports/stage/maybeCreateGeneratedReportJob';

interface RouteParams {
  params: Promise<{ studentId: string }>;
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

    const coachProfile = await getCoachProfileForUser(authSession.user.id);
    if (!coachProfile) {
      return NextResponse.json({ error: 'Coach profile not found' }, { status: 404 });
    }

    const reports = await prisma.generatedPedagogicalReport.findMany({
      where: {
        studentId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      reports,
    });
  } catch (error) {
    console.error('[API] Get generated reports failed:', error);
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

    const coachProfile = await getCoachProfileForUser(authSession.user.id);
    if (!coachProfile) {
      return NextResponse.json({ error: 'Coach profile not found' }, { status: 404 });
    }

    const { subject, kind, stageSlug } = await request.json();

    if (!subject || !kind || !stageSlug) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Subject, kind and stageSlug are required.' },
        { status: 400 }
      );
    }

    const jobStatus = await maybeCreateGeneratedReportJob({
      studentId,
      subject,
      kind,
      stageSlug,
    });

    return NextResponse.json({
      success: true,
      jobStatus,
    });
  } catch (error) {
    console.error('[API] Request generated report failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
