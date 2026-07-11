import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { assertCoachCanAccessStudent } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { computeDiagnostics } from '@/lib/diagnostic/maths-terminale/scoring';
import { DOMAINS, QUESTIONS_OPEN } from '@/lib/diagnostic/maths-terminale/data';
import type { DiagnosticSourceData, TeacherGrade } from '@/lib/diagnostic/maths-terminale/types';
import { serializeError } from '@/lib/utils/serialize-error';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

const routeParamsSchema = z.object({
  studentId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,191}$/),
}).strict();

const teacherGradeValueSchema = z.object({
  score: z.union([z.number().min(0).max(20), z.literal('')]),
  comment: z.string().max(2000),
  errors: z.array(z.string().max(500)).max(20),
  mode: z.enum(['global', 'detailed']),
  criteria: z.record(z.string().regex(/^\d+$/), z.union([z.number().min(0).max(20), z.literal('')]))
    .refine((obj) => Object.keys(obj).length <= 30, {
      message: 'criteria ne peut pas contenir plus de 30 entrées',
    }),
}).strict();

const OPEN_QUESTION_IDS = QUESTIONS_OPEN.map(q => q.id);

const teacherGradesSchema = z.object({
  teacherGrades: z.record(z.string().min(1).max(120), teacherGradeValueSchema)
    .refine((r) => {
      const keys = Object.keys(r);
      return keys.length <= OPEN_QUESTION_IDS.length && keys.every(k => OPEN_QUESTION_IDS.includes(k));
    }, {
      message: `teacherGrades keys must be valid open question IDs (${OPEN_QUESTION_IDS.join(', ')})`,
    }),
}).strict();

function validationFailed() {
  return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
}

/**
 * GET /api/coach/students/[studentId]/bilan-diagnostic-maths-terminale
 * Returns the student's diagnostic bilan. Requires COACH role + assignment.
 */
export async function GET(_request: Request, { params }: RouteParams) {
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
    } catch {
      return NextResponse.json(
        { error: 'Forbidden', message: "Vous n'êtes pas assigné à cet élève" },
        { status: 403 }
      );
    }

    const bilan = await prisma.bilan.findFirst({
      where: {
        studentId,
        type: 'DIAGNOSTIC_PRE_STAGE',
        subject: 'MATHEMATIQUES',
        sourceVersion: 'maths_terminale_v1',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!bilan) {
      return NextResponse.json({ bilan: null });
    }

    return NextResponse.json({ bilan });
  } catch (error) {
    console.error('[API Coach Bilan Diagnostic Maths Terminale GET]', serializeError(error));
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/students/[studentId]/bilan-diagnostic-maths-terminale
 * Coach submits teacher grades → recomputes full score → saves.
 * Body: { teacherGrades: Record<string, TeacherGrade> }
 */
export async function PATCH(request: Request, { params }: RouteParams) {
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
    } catch {
      return NextResponse.json(
        { error: 'Forbidden', message: "Vous n'êtes pas assigné à cet élève" },
        { status: 403 }
      );
    }

    const parsedBody = teacherGradesSchema.safeParse(await request.json());
    if (!parsedBody.success) return validationFailed();
    const { teacherGrades } = parsedBody.data as { teacherGrades: Record<string, TeacherGrade> };

    // Find the bilan
    const existingBilan = await prisma.bilan.findFirst({
      where: {
        studentId,
        type: 'DIAGNOSTIC_PRE_STAGE',
        subject: 'MATHEMATIQUES',
        sourceVersion: 'maths_terminale_v1',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!existingBilan) {
      return NextResponse.json({ error: 'Bilan not found' }, { status: 404 });
    }

    // Get existing source data
    const existingSourceData = existingBilan.sourceData as unknown as DiagnosticSourceData;
    const { progress = {}, qcmAnswers = {} } = existingSourceData;

    // Recompute with teacher grades
    const evaluatedData = computeDiagnostics(progress, qcmAnswers, teacherGrades, true);

    // Find the coach profile
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: authSession.user.id },
      select: { id: true },
    });

    // Build domain scores
    const domainScoresArr = DOMAINS.map(d => ({
      domain: d.title,
      domainId: d.id,
      score: evaluatedData.domainScores[d.id] ?? 0,
    }));

    const updatedSourceData: DiagnosticSourceData = {
      ...existingSourceData,
      teacherGrades,
      isTeacherGraded: true,
      evaluatedData,
      step: 'results',
    };

    const updatedBilan = await prisma.bilan.update({
      where: { id: existingBilan.id },
      data: {
        sourceData: updatedSourceData as any,
        globalScore: evaluatedData.globalPercentage,
        domainScores: domainScoresArr as any,
        coachId: coachProfile?.id ?? undefined,
        status: 'COMPLETED',
        progress: 100,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, bilan: updatedBilan });
  } catch (error) {
    console.error('[API Coach Bilan Diagnostic Maths Terminale PATCH]', serializeError(error));
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
