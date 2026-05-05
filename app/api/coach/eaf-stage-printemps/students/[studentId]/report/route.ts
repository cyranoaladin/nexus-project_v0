import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import {
  assertCoachCanAccessStudent,
  getCoachProfileForUser,
  CoachNotAssignedError,
} from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { coachEafBilanSchema, COACH_EAF_META, STAGE_SLUG as EAF_STAGE_SLUG } from '@/lib/coach/eaf-stage-printemps/types';
import type { CoachEafSourceData } from '@/lib/coach/eaf-stage-printemps/types';
import { generateParentEafStageReport } from '@/lib/coach/eaf-stage-printemps/generate-parent-report';

const COACH_SOURCE_VERSION = 'coach_eaf_stage_printemps_v1';
const STUDENT_SOURCE_VERSION = 'eaf_stage_printemps_v1';
const BILAN_TYPE = 'STAGE_POST' as const;
const BILAN_SUBJECT = 'FRANCAIS';
const MAX_PAYLOAD_SIZE = 100_000;

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

/**
 * GET /api/coach/eaf-stage-printemps/students/[studentId]/report
 * Returns the coach bilan for a student + optional student questionnaire summary.
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

    // Get student info
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

    // Get coach bilan for this student
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

    // Get student questionnaire (read-only summary)
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

    // Extract student questionnaire summary (read-only)
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
        priorityWork: finalReview.priorityWork as string | undefined,
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
    logger.error({ err: error }, '[API] coach/eaf-stage-printemps/students/[studentId]/report GET failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/eaf-stage-printemps/students/[studentId]/report
 * Create or update the coach bilan. action='draft' saves as PENDING, action='complete' saves as COMPLETED.
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;

    const sessionOrError = await requireRole('COACH');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    // Payload size protection
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        { error: 'Payload too large', message: 'Le contenu dépasse la taille maximale autorisée.' },
        { status: 413 }
      );
    }

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

    const json = await request.json();
    const parseResult = coachEafBilanSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Validation échouée', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { action, ...formData } = parseResult.data;
    const isCompletion = action === 'complete';

    // Get coach profile (to store coachId on bilan — comes from server, not client)
    const coachProfile = await getCoachProfileForUser(authSession.user.id);

    // Get student info for denormalized fields
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

    // Build sourceData — coachId comes from server session only
    const sourceData: CoachEafSourceData = {
      meta: {
        ...COACH_EAF_META,
        studentId,
        coachId: coachProfile?.id ?? authSession.user.id,
        savedAt: new Date().toISOString(),
        ...(isCompletion ? { completedAt: new Date().toISOString() } : {}),
      },
      attendanceAndEngagement: formData.attendanceAndEngagement ?? {},
      examExpectations: formData.examExpectations ?? {},
      commentary: formData.commentary ?? {},
      dissertation: formData.dissertation ?? {},
      writing: formData.writing ?? {},
      autonomyAndMethod: formData.autonomyAndMethod ?? {},
      progress: formData.progress ?? {},
      parentRecommendations: formData.parentRecommendations ?? {},
    };

    // Find existing bilan
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

    // Block modification of VALIDATED bilan (isPublished=true + COMPLETED)
    if (existingBilan && existingBilan.status === 'COMPLETED' && existingBilan.isPublished) {
      return NextResponse.json(
        { error: 'Locked', message: 'Ce bilan a été validé et ne peut plus être modifié.' },
        { status: 403 }
      );
    }

    // Generate markdown renderings on completion
    const reportMarkdown = isCompletion
      ? generateParentEafStageReport(sourceData, {
          firstName: student.user?.firstName ?? undefined,
          lastName: student.user?.lastName ?? undefined,
        })
      : null;

    let bilan;
    if (existingBilan) {
      bilan = await prisma.bilan.update({
        where: { id: existingBilan.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sourceData: sourceData as any,
          status: isCompletion ? 'COMPLETED' : 'PENDING',
          progress: isCompletion ? 100 : 50,
          ...(reportMarkdown ? { studentMarkdown: reportMarkdown, parentsMarkdown: reportMarkdown } : {}),
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sourceData: sourceData as any,
          sourceVersion: COACH_SOURCE_VERSION,
          status: isCompletion ? 'COMPLETED' : 'PENDING',
          progress: isCompletion ? 100 : 50,
          coachId: coachProfile?.id,
          engineVersion: 'manual_coach',
          ...(reportMarkdown ? { studentMarkdown: reportMarkdown, parentsMarkdown: reportMarkdown } : {}),
        },
      });
    }

    logger.info(
      { bilanId: bilan.id, studentId, coachId: coachProfile?.id, action },
      '[API] coach/eaf-stage-printemps/students/[studentId]/report saved'
    );

    return NextResponse.json({ success: true, bilan });
  } catch (error) {
    logger.error({ err: error }, '[API] coach/eaf-stage-printemps/students/[studentId]/report POST failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/eaf-stage-printemps/students/[studentId]/report
 * Mark a completed bilan as VALIDATED (isPublished=true).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
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

    // Look up stageId for linking the bilan to its stage in the student dashboard
    const stage = await prisma.stage.findUnique({
      where: { slug: EAF_STAGE_SLUG },
      select: { id: true },
    });

    const bilan = await prisma.bilan.update({
      where: { id: existingBilan.id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
        updatedAt: new Date(),
        ...(stage ? { stageId: stage.id } : {}),
      },
    });

    logger.info(
      { bilanId: bilan.id, studentId, coachId: coachProfile?.id },
      '[API] coach/eaf-stage-printemps/students/[studentId]/report VALIDATED'
    );

    return NextResponse.json({ success: true, bilan });
  } catch (error) {
    logger.error({ err: error }, '[API] coach/eaf-stage-printemps/students/[studentId]/report PATCH failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
