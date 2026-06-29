import { NextResponse } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { isCoachAssignedToStudent } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import {
import { serializeError } from '@/lib/utils/serialize-error';
  computeCoachStudentSummary,
  getSubjectDetails,
  getPatternDetails,
} from '@/lib/nsi-pratique-2026/coach-summary';
import { getRecommendedNextAction } from '@/lib/nsi-pratique-2026/recommendations';
import type { NsiProgress } from '@/data/nsi-pratique-2026/types';

/**
 * GET /api/coach/nsi-pratique-2026/students/[studentId]/progress
 * Returns a specific student's NSI progress with computed summary and structured details.
 * Coach must be assigned to this student (RBAC enforced).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const sessionOrError = await requireAnyRole(['COACH', 'ADMIN']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const session = sessionOrError;

    const { studentId } = await params;

    // Get student profile
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        userId: true,
        gradeLevel: true,
        academicTrack: true,
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Élève introuvable' }, { status: 404 });
    }

    // Verify coach is assigned to this student
    const isAssigned = await isCoachAssignedToStudent({
      coachUserId: session.user.id,
      studentId,
    });

    if (!isAssigned) {
      return NextResponse.json(
        { error: "Vous n'êtes pas assigné à cet élève" },
        { status: 403 }
      );
    }

    const record = await prisma.nsiPracticeProgress.findUnique({
      where: { userId: student.userId },
      select: { data: true, updatedAt: true, version: true },
    });

    const progressData = record?.data as unknown as NsiProgress | null;
    const lastUpdated = record?.updatedAt?.toISOString() ?? null;

    // Compute summary
    const summary = computeCoachStudentSummary(
      {
        studentId,
        userId: student.userId,
        firstName: student.user.firstName ?? '',
        lastName: student.user.lastName ?? '',
      },
      progressData,
      lastUpdated,
    );

    // Compute structured details (only if progress exists)
    const details = progressData ? {
      subjects: getSubjectDetails(progressData),
      patterns: getPatternDetails(progressData),
      fiveDayPlan: progressData.fiveDayPlan ?? {},
      selfAssessment: progressData.selfAssessment ?? {},
      mockExams: progressData.mockExams ?? [],
      oralPhrases: progressData.oralPhrases ?? {},
      flashcards: progressData.flashcards ?? {},
    } : null;

    // Top 3 recommendations
    const recommendations: string[] = [];
    if (progressData) {
      const rec = getRecommendedNextAction(progressData);
      if (rec) recommendations.push(rec.label);
      // Add more contextual recommendations
      if (summary.subjectsToReview > 0) {
        recommendations.push(`${summary.subjectsToReview} sujet(s) marqué(s) "à revoir" — à reprendre en priorité`);
      }
      if (summary.patternsMastered < 5) {
        recommendations.push(`Seulement ${summary.patternsMastered}/8 patrons maîtrisés — renforcer les patrons de code`);
      }
      if (summary.mockExamsCount === 0 && summary.subjectsMastered >= 5) {
        recommendations.push('Aucun sujet blanc réalisé — en programmer un en conditions réelles (55 min)');
      }
      if (summary.planTotal > 0 && summary.planCompleted < summary.planTotal) {
        recommendations.push(`Plan 5 jours : ${summary.planCompleted}/${summary.planTotal} tâches complétées`);
      }
    }

    return NextResponse.json({
      student: {
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        gradeLevel: student.gradeLevel,
        academicTrack: student.academicTrack,
      },
      summary,
      details,
      recommendations: recommendations.slice(0, 4),
      updatedAt: lastUpdated,
      version: record?.version ?? null,
    });
  } catch (error) {
    console.error('[Coach NSI Student Progress GET] Error:', serializeError(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
