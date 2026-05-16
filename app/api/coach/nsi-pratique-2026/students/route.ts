import { NextResponse } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { getAssignedStudentsForCoach } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';

type AssignmentStudent = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
};

type CoachAssignment = {
  subjects?: string[];
  student: AssignmentStudent;
};

/**
 * GET /api/coach/nsi-pratique-2026/students
 * Returns list of NSI students assigned to the coach with their progress summary.
 */
export async function GET() {
  try {
    const sessionOrError = await requireAnyRole(['COACH', 'ADMIN']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;
    const session = sessionOrError;

    const assignments = await getAssignedStudentsForCoach({ coachUserId: session.user.id });

    // Filter to assignments that include NSI subject
    const nsiAssignments = (assignments as CoachAssignment[]).filter(
      (a) => a.subjects?.includes('NSI')
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
      const data = prog?.data as Record<string, unknown> | null;

      // Compute summary from progress data
      let subjectsMastered = 0;
      let subjectsTotal = 0;
      if (data?.subjects && typeof data.subjects === 'object') {
        const subjects = data.subjects as Record<string, { status?: string }>;
        subjectsTotal = Object.keys(subjects).length;
        subjectsMastered = Object.values(subjects).filter(
          (s) => s.status === 'mastered'
        ).length;
      }

      return {
        studentId: a.student.id,
        userId: a.student.userId,
        firstName: a.student.firstName,
        lastName: a.student.lastName,
        hasProgress: !!prog,
        lastUpdated: prog?.updatedAt?.toISOString() ?? null,
        summary: {
          subjectsMastered,
          subjectsTotal,
        },
      };
    });

    return NextResponse.json({ students, count: students.length });
  } catch (error) {
    console.error('[Coach NSI Students GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
