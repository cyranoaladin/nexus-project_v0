import { NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { assertCoachCanAccessStudent } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

/**
 * GET /api/coach/students/[studentId]
 *
 * Returns detailed information about a specific student.
 * Requires: COACH role + active assignment to this student
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { studentId } = await params;
    const sessionOrError = await requireRole(UserRole.COACH);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const session = sessionOrError;

    // RBAC check
    if (!can(session.user.role, 'READ_OWN', 'STUDENT')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Permission insuffisante' },
        { status: 403 }
      );
    }

    // Ownership check - throws if not assigned
    try {
      await assertCoachCanAccessStudent({
        coachUserId: session.user.id,
        studentId,
      });
    } catch (accessError) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Vous n\'êtes pas assigné à cet élève' },
        { status: 403 }
      );
    }

    // Fetch detailed student data
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        parent: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        coachAssignments: {
          where: { status: 'ACTIVE' },
          include: {
            coach: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        assessments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        sessions: {
          orderBy: { scheduledAt: 'desc' },
          take: 5,
          include: {
            coach: true,
          },
        },
        trajectories: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            sessions: true,
            assessments: true,
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Élève non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      student,
    });
  } catch (error) {
    console.error('[API Coach Student Detail GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la récupération des données' },
      { status: 500 }
    );
  }
}
