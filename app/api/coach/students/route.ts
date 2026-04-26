import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { getAssignedStudentsForCoach } from '@/lib/rbac/coach-student-access';
import { UserRole } from '@prisma/client';

/**
 * GET /api/coach/students
 *
 * Returns all students assigned to the authenticated coach.
 * Requires: COACH role
 * Enforces: Only assigned students (via CoachStudentAssignment)
 */
export async function GET() {
  try {
    const sessionOrError = await requireRole(UserRole.COACH);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const session = sessionOrError;

    // RBAC check
    if (!can(session.user.role, 'READ_OWN', 'STUDENT')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Vous n\'avez pas la permission de voir les élèves' },
        { status: 403 }
      );
    }

    // Get assigned students
    const students = await getAssignedStudentsForCoach({
      coachUserId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error('[API Coach Students GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la récupération des élèves' },
      { status: 500 }
    );
  }
}
