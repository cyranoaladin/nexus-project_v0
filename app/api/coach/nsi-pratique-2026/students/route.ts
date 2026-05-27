import { NextResponse } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { getAssignedStudentsForCoach } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { canAccessNsiPratique } from '@/lib/nsi-pratique-2026/access';
import { computeCoachStudentSummary } from '@/lib/nsi-pratique-2026/coach-summary';
import type { NsiProgress } from '@/data/nsi-pratique-2026/types';

type AssignmentStudent = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
};

type CoachAssignment = {
  subjects?: string[];
  student: AssignmentStudent;
};

/**
 * GET /api/coach/nsi-pratique-2026/students
 * Returns list of NSI students assigned to the coach with enriched progress summary.
 */
export async function GET() {
  try {
    const sessionOrError = await requireAnyRole(['COACH', 'ADMIN']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const session = sessionOrError;

    if (!(await canAccessNsiPratique(session.user))) {
      return NextResponse.json({ error: 'Accès NSI pratique non autorisé' }, { status: 403 });
    }

    const assignments = await getAssignedStudentsForCoach({ coachUserId: session.user.id });

    // Filter to assignments that include NSI subject
    const nsiAssignments = (assignments as CoachAssignment[]).filter(
      (a) => a.subjects?.includes('NSI'),
    );

    if (nsiAssignments.length === 0) {
      return NextResponse.json({ students: [], count: 0 });
    }

    // Get user IDs to fetch progress
    const userIds = nsiAssignments.map((a) => a.student.userId);

    const progressRecords = await prisma.nsiPracticeProgress.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, data: true, updatedAt: true },
    });

    const progressByUserId = new Map(
      progressRecords.map((r) => [r.userId, r])
    );

    const students = nsiAssignments.map((a) => {
      const prog = progressByUserId.get(a.student.userId);
      const progressData = prog?.data as unknown as NsiProgress | null;

      return computeCoachStudentSummary(
        {
          studentId: a.student.id,
          userId: a.student.userId,
          firstName: a.student.firstName,
          lastName: a.student.lastName,
        },
        progressData,
        prog?.updatedAt?.toISOString() ?? null,
      );
    });

    return NextResponse.json({ students, count: students.length });
  } catch (error) {
    console.error('[Coach NSI Students GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
