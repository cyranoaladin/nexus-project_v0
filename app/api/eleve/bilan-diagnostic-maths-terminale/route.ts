import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { computeDiagnostics } from '@/lib/diagnostic/maths-terminale/scoring';
import type { ChapterProgress, DiagnosticSourceData, OpenAnswer } from '@/lib/diagnostic/maths-terminale/types';
import { DOMAINS } from '@/lib/diagnostic/maths-terminale/data';
import { serializeError } from '@/lib/utils/serialize-error';
import { z } from 'zod';

const BILAN_SOURCE_VERSION = 'maths_terminale_v1';
const chapterProgressSchema = z.object({
  declared: z.number().int().min(0).max(5).nullable(),
  confidence: z.number().int().min(1).max(5),
}).strict();
const openAnswerSchema = z.object({
  text: z.string().max(5000),
  status: z.string().max(200),
}).strict();
const diagnosticPayloadSchema = z.object({
  progress: z.record(z.string(), chapterProgressSchema).default({}),
  qcmAnswers: z.record(z.string(), z.coerce.number().int()).default({}),
  openAnswers: z.record(z.string(), openAnswerSchema).default({}),
  step: z.enum(['progress', 'qcm', 'open', 'results']).default('progress'),
}).strict();

/**
 * GET /api/eleve/bilan-diagnostic-maths-terminale
 * Returns the student's current diagnostic bilan (in progress or completed).
 */
export async function GET() {
  try {
    const sessionOrError = await requireRole('ELEVE');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    // Find the student record
    const student = await prisma.student.findUnique({
      where: { userId: authSession.user.id },
      select: {
        id: true,
        gradeLevel: true,
        academicTrack: true,
        specialties: true,
        user: { select: { firstName: true, lastName: true, email: true } }
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Eligibility check: TERMINALE + EDS_GENERALE + MATHEMATIQUES specialty
    const isEligible =
      student.gradeLevel === 'TERMINALE' &&
      student.academicTrack === 'EDS_GENERALE' &&
      student.specialties.includes('MATHEMATIQUES' as any);

    if (!isEligible) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Ce bilan est réservé aux élèves de Terminale EDS Mathématiques.' },
        { status: 403 }
      );
    }

    // Get the latest diagnostic bilan for this student
    const bilan = await prisma.bilan.findFirst({
      where: {
        studentId: student.id,
        type: 'DIAGNOSTIC_PRE_STAGE',
        subject: 'MATHEMATIQUES',
        sourceVersion: BILAN_SOURCE_VERSION,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!bilan) {
      return NextResponse.json({ bilan: null });
    }

    const studentName = student.user ? [student.user.firstName, student.user.lastName].filter(Boolean).join(' ') || student.user.email : 'Élève';

    return NextResponse.json({ bilan, studentName });
  } catch (error) {
    console.error('[API ELEVE Bilan Diagnostic Maths Terminale GET]', serializeError(error));
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/eleve/bilan-diagnostic-maths-terminale
 * Create or update the student's diagnostic. Computes scores and saves to Bilan.
 * Body: { progress, qcmAnswers, openAnswers, step }
 */
export async function POST(request: Request) {
  try {
    const sessionOrError = await requireRole('ELEVE');
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const authSession = sessionOrError;

    const parsedBody = diagnosticPayloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid diagnostic payload' }, { status: 400 });
    }
    const progress = parsedBody.data.progress as Record<string, ChapterProgress>;
    const qcmAnswers = parsedBody.data.qcmAnswers;
    const openAnswers = parsedBody.data.openAnswers as Record<string, OpenAnswer>;
    const step = parsedBody.data.step;

    // Find the student record
    const student = await prisma.student.findUnique({
      where: { userId: authSession.user.id },
      select: {
        id: true,
        gradeLevel: true,
        academicTrack: true,
        specialties: true,
        user: {
          select: { email: true, firstName: true, lastName: true }
        }
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Eligibility check
    const isEligible =
      student.gradeLevel === 'TERMINALE' &&
      student.academicTrack === 'EDS_GENERALE' &&
      student.specialties.includes('MATHEMATIQUES' as any);

    if (!isEligible) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Ce bilan est réservé aux élèves de Terminale EDS Mathématiques.' },
        { status: 403 }
      );
    }

    // Compute provisional scores (no teacher grades yet from student submission)
    const evaluatedData = computeDiagnostics(progress, qcmAnswers, {}, false);

    // Build domain scores array for Bilan model
    const domainScoresArr = DOMAINS.map(d => ({
      domain: d.title,
      domainId: d.id,
      score: evaluatedData.domainScores[d.id] ?? 0,
    }));

    const sourceData: DiagnosticSourceData = {
      version: BILAN_SOURCE_VERSION,
      progress,
      qcmAnswers,
      openAnswers,
      teacherGrades: {},
      isTeacherGraded: false,
      evaluatedData,
      step,
    };

    const studentName = [student.user.firstName, student.user.lastName].filter(Boolean).join(' ') || student.user.email;

    // Upsert: find existing bilan or create new one
    const existingBilan = await prisma.bilan.findFirst({
      where: {
        studentId: student.id,
        type: 'DIAGNOSTIC_PRE_STAGE',
        subject: 'MATHEMATIQUES',
        sourceVersion: BILAN_SOURCE_VERSION,
      },
      orderBy: { createdAt: 'desc' },
    });

    let bilan;
    if (existingBilan) {
      bilan = await prisma.bilan.update({
        where: { id: existingBilan.id },
        data: {
          sourceData: sourceData as any,
          globalScore: evaluatedData.qcmPercentage, // provisional QCM score until teacher grades
          domainScores: domainScoresArr as any,
          status: step === 'results' ? 'SCORING' : 'PENDING',
          progress: step === 'results' ? 100 : 50,
          updatedAt: new Date(),
        },
      });
    } else {
      bilan = await prisma.bilan.create({
        data: {
          type: 'DIAGNOSTIC_PRE_STAGE',
          subject: 'MATHEMATIQUES',
          studentId: student.id,
          studentEmail: student.user.email,
          studentName,
          sourceData: sourceData as any,
          globalScore: evaluatedData.qcmPercentage,
          domainScores: domainScoresArr as any,
          sourceVersion: BILAN_SOURCE_VERSION,
          status: step === 'results' ? 'SCORING' : 'PENDING',
          progress: step === 'results' ? 100 : 50,
        },
      });
    }

    return NextResponse.json({ success: true, bilan });
  } catch (error) {
    console.error('[API ELEVE Bilan Diagnostic Maths Terminale POST]', serializeError(error));
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
