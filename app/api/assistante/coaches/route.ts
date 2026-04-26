import { NextResponse } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { activeAssignmentWhere } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { parsePagination, createPaginationMeta } from '@/lib/api/pagination';

/**
 * GET /api/assistante/coaches
 *
 * Returns a list of all coaches with their assignments count.
 * Requires: ASSISTANTE or ADMIN role
 * Query params:
 *   - search: string (search by name, pseudonym, or email)
 *   - availableOnline: 'true' | 'false'
 *   - page: number (default: 1)
 *   - limit: number (default: 20, max: 100)
 * Note: subject filter not yet implemented (CoachProfile.subjects is Json)
 */
export async function GET(request: Request) {
  try {
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const session = sessionOrError;

    if (!can(session.user.role, 'READ', 'USER')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Permission insuffisante' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const availableOnline = searchParams.get('availableOnline');
    const { page, limit, skip } = parsePagination(searchParams);

    // Build where clause
    const where: any = {};

    if (availableOnline === 'true') {
      where.availableOnline = true;
    } else if (availableOnline === 'false') {
      where.availableOnline = false;
    }

    if (search) {
      where.OR = [
        { pseudonym: { contains: search, mode: 'insensitive' } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Fetch coaches with pagination
    const now = new Date();
    const [coaches, total] = await Promise.all([
      prisma.coachProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          studentAssignments: {
            where: activeAssignmentWhere(now),
            include: {
              student: {
                select: {
                  id: true,
                  gradeLevel: true,
                  academicTrack: true,
                },
              },
            },
          },
          _count: {
            select: {
              studentAssignments: true,
              sessions: true,
            },
          },
        },
      }),
      prisma.coachProfile.count({ where }),
    ]);

    // Transform data for response
    // Note: activeStudents uses studentAssignments.length (already filtered by activeAssignmentWhere)
    // instead of _count which would include historical assignments
    const formattedCoaches = coaches.map((coach) => ({
      id: coach.id,
      userId: coach.userId,
      firstName: coach.user.firstName,
      lastName: coach.user.lastName,
      email: coach.user.email,
      pseudonym: coach.pseudonym,
      title: coach.title,
      tag: coach.tag,
      subjects: coach.subjects,
      availableOnline: coach.availableOnline,
      availableInPerson: coach.availableInPerson,
      stats: {
        activeStudents: coach.studentAssignments.length,
        totalSessions: coach._count.sessions,
      },
      activeAssignments: coach.studentAssignments.map((assignment) => ({
        assignmentId: assignment.id,
        studentId: assignment.student.id,
        studentGrade: assignment.student.gradeLevel,
        studentTrack: assignment.student.academicTrack,
        subjects: assignment.subjects,
      })),
      createdAt: coach.createdAt,
    }));

    return NextResponse.json({
      success: true,
      pagination: createPaginationMeta(page, limit, total),
      coaches: formattedCoaches,
    });
  } catch (error) {
    console.error('[API Assistante Coaches GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la récupération des coachs' },
      { status: 500 }
    );
  }
}
