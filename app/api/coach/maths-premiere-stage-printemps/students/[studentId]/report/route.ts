import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import {
  assertCoachCanAccessStudent,
  getCoachProfileForUser,
  CoachNotAssignedError,
} from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { coachMathsBilanSchema, COACH_MATHS_META } from '@/lib/coach/maths-premiere-stage-printemps/types';
import type { CoachMathsSourceData } from '@/lib/coach/maths-premiere-stage-printemps/types';

const COACH_SOURCE_VERSION = 'coach_maths_premiere_stage_printemps_v1';
const STUDENT_SOURCE_VERSION = 'maths_premiere_stage_printemps_v1';
const BILAN_TYPE = 'STAGE_POST' as const;
const BILAN_SUBJECT = 'MATHEMATIQUES';
const MAX_PAYLOAD_SIZE = 120_000;

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;

    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

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

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        gradeLevel: true,
        academicTrack: true,
        school: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const coachProfile = await getCoachProfileForUser(authSession.user.id);

    const coachBilan = await prisma.bilan.findFirst({
      where: {
        studentId,
        type: BILAN_TYPE,
        subject: BILAN_SUBJECT,
        sourceVersion: COACH_SOURCE_VERSION,
        ...(coachProfile ? { coachId: coachProfile.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const studentBilan = await prisma.bilan.findFirst({
      where: {
        studentId,
        type: BILAN_TYPE,
        subject: BILAN_SUBJECT,
        sourceVersion: STUDENT_SOURCE_VERSION,
      },
      select: {
        id: true,
        sourceData: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    let studentSummary = null;
    if (studentBilan?.sourceData) {
      const sd = studentBilan.sourceData as Record<string, unknown>;
      const answers = (sd.answers ?? {}) as Record<string, Record<string, unknown>>;
      const finalReview = (answers.finalReview ?? {}) as Record<string, unknown>;
      const beforeStage = (answers.beforeStage ?? {}) as Record<string, unknown>;
      studentSummary = {
        beforeConfidence: beforeStage.confidence as string | undefined,
        afterConfidence: finalReview.afterConfidence as string | undefined,
        beforeStress: beforeStage.stress as string | undefined,
        afterStress: finalReview.afterStress as string | undefined,
        bestProgress: finalReview.bestProgress as string | undefined,
        priorityWork: finalReview.priorityChapter as string | undefined,
        finalMessage: finalReview.finalMessage as string | undefined,
        progressFeeling: finalReview.progressFeeling as string | undefined,
        submittedAt: studentBilan.status === 'COMPLETED' ? studentBilan.updatedAt?.toISOString() : undefined,
      };
    }

    return NextResponse.json({
      student: {
        id: student.id,
        firstName: student.user?.firstName,
        lastName: student.user?.lastName,
        email: student.user?.email,
        gradeLevel: student.gradeLevel,
        academicTrack: student.academicTrack,
        school: student.school,
      },
      coachBilan,
      studentSummary,
    });
  } catch (error) {
    logger.error({ err: error }, '[API] coach/maths-premiere/students/[studentId]/report GET failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;

    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        { error: 'Payload too large', message: 'Le contenu dépasse la taille maximale autorisée.' },
        { status: 413 }
      );
    }

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

    const json = await request.json();
    const parseResult = coachMathsBilanSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Validation échouée', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { action, ...formData } = parseResult.data;
    const isCompletion = action === 'complete';

    const coachProfile = await getCoachProfileForUser(authSession.user.id);

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const studentName = [student.user?.firstName, student.user?.lastName].filter(Boolean).join(' ') || student.user?.email || 'Élève';

    const sourceData: CoachMathsSourceData = {
      meta: {
        ...COACH_MATHS_META,
        studentId,
        coachId: coachProfile?.id ?? authSession.user.id,
        savedAt: new Date().toISOString(),
        ...(isCompletion ? { completedAt: new Date().toISOString() } : {}),
      },
      attendanceAndEngagement: formData.attendanceAndEngagement ?? {},
      automatismes: formData.automatismes ?? {},
      analysis: formData.analysis ?? {},
      sequences: formData.sequences ?? {},
      scalarProduct: formData.scalarProduct ?? {},
      probabilities: formData.probabilities ?? {},
      finalAssessment: formData.finalAssessment ?? {},
      parentRecommendations: formData.parentRecommendations ?? {},
    };

    const existingBilan = await prisma.bilan.findFirst({
      where: {
        studentId,
        type: BILAN_TYPE,
        subject: BILAN_SUBJECT,
        sourceVersion: COACH_SOURCE_VERSION,
        ...(coachProfile ? { coachId: coachProfile.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingBilan && existingBilan.status === 'COMPLETED' && existingBilan.isPublished) {
      return NextResponse.json(
        { error: 'Locked', message: 'Ce bilan a été validé et ne peut plus être modifié.' },
        { status: 403 }
      );
    }

    let bilan;
    if (existingBilan) {
      bilan = await prisma.bilan.update({
        where: { id: existingBilan.id },
        data: {
          sourceData: sourceData as any,
          status: isCompletion ? 'COMPLETED' : 'PENDING',
          progress: isCompletion ? 100 : 50,
          updatedAt: new Date(),
        },
      });
    } else {
      bilan = await prisma.bilan.create({
        data: {
          type: BILAN_TYPE,
          subject: BILAN_SUBJECT,
          studentId,
          studentEmail: student.user?.email ?? '',
          studentName,
          sourceData: sourceData as any,
          sourceVersion: COACH_SOURCE_VERSION,
          status: isCompletion ? 'COMPLETED' : 'PENDING',
          progress: isCompletion ? 100 : 50,
          coachId: coachProfile?.id,
          engineVersion: 'manual_coach',
        },
      });
    }

    logger.info(
      { bilanId: bilan.id, studentId, coachId: coachProfile?.id, action },
      '[API] coach/maths-premiere/students/[studentId]/report saved'
    );

    return NextResponse.json({ success: true, bilan });
  } catch (error) {
    logger.error({ err: error }, '[API] coach/maths-premiere/students/[studentId]/report POST failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;

    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

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

    const existingBilan = await prisma.bilan.findFirst({
      where: {
        studentId,
        type: BILAN_TYPE,
        subject: BILAN_SUBJECT,
        sourceVersion: COACH_SOURCE_VERSION,
        ...(coachProfile ? { coachId: coachProfile.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!existingBilan) {
      return NextResponse.json({ error: 'Not found', message: 'Aucun bilan trouvé pour cet élève.' }, { status: 404 });
    }

    if (existingBilan.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Le bilan doit être complété avant de pouvoir être validé.' },
        { status: 400 }
      );
    }

    const bilan = await prisma.bilan.update({
      where: { id: existingBilan.id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.info(
      { bilanId: bilan.id, studentId, coachId: coachProfile?.id },
      '[API] coach/maths-premiere/students/[studentId]/report VALIDATED'
    );

    return NextResponse.json({ success: true, bilan });
  } catch (error) {
    logger.error({ err: error }, '[API] coach/maths-premiere/students/[studentId]/report PATCH failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
