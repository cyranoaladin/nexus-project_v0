import { NextResponse } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { isCoachAssignedToStudent } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/coach/nsi-pratique-2026/students/[studentId]/progress
 * Returns a specific student's NSI progress (coach must be assigned to this student).
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

    // Get student's userId from Student profile
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { userId: true },
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

    if (!record) {
      return NextResponse.json(
        { data: null, updatedAt: null, message: "Aucune progression NSI enregistrée pour cet élève" },
        { status: 200 }
      );
    }

    return NextResponse.json({
      data: record.data,
      updatedAt: record.updatedAt.toISOString(),
      version: record.version,
    });
  } catch (error) {
    console.error('[Coach NSI Student Progress GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
