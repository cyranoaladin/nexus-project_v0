import { NextResponse } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/assistante/coaches
 *
 * Returns a list of all coaches with their assignments count.
 * Requires: ASSISTANTE or ADMIN role
 * Query params:
 *   - search: string (search by name, pseudonym, or email)
 *   - subject: Subject enum (filter by specialty)
 *   - availableOnline: 'true' | 'false'
 *   - page: number (default: 1)
 *   - limit: number (default: 20, max: 100)
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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

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
            where: { status: 'ACTIVE' },
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
        activeStudents: coach._count.studentAssignments,
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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
