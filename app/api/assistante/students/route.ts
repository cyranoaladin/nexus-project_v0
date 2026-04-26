import { NextResponse } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { activeAssignmentWhere } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { GradeLevel, AcademicTrack, StmgPathway } from '@prisma/client';
import { parsePagination, parseEnumParam, createPaginationMeta } from '@/lib/api/pagination';

/**
 * GET /api/assistante/students
 *
 * Returns a paginated and filterable list of all students.
 * Requires: ASSISTANTE or ADMIN role
 * Query params:
 *   - search: string (search by name or email)
 *   - gradeLevel: GradeLevel
 *   - academicTrack: AcademicTrack
 *   - stmgPathway: StmgPathway
 *   - hasCoach: 'true' | 'false' | 'all'
 *   - page: number (default: 1)
 *   - limit: number (default: 20, max: 100)
 */
export async function GET(request: Request) {
  try {
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const session = sessionOrError;

    // RBAC check
    if (!can(session.user.role, 'READ', 'STUDENT')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Permission insuffisante' },
        { status: 403 }
      );
    }

    // Parse query parameters with validation
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    // Validate enum parameters
    const gradeLevel = parseEnumParam(searchParams.get('gradeLevel'), GradeLevel);
    const academicTrack = parseEnumParam(searchParams.get('academicTrack'), AcademicTrack);
    const stmgPathway = parseEnumParam(searchParams.get('stmgPathway'), StmgPathway);

    const hasCoach = searchParams.get('hasCoach') || 'all';
    const { page, limit, skip } = parsePagination(searchParams);

    // Build where clause
    const where: any = {};

    if (gradeLevel) {
      where.gradeLevel = gradeLevel;
    }

    if (academicTrack) {
      where.academicTrack = academicTrack;
    }

    if (stmgPathway) {
      where.stmgPathway = stmgPathway;
    }

    // Apply active assignment window for hasCoach filter
    const now = new Date();
    if (hasCoach === 'true') {
      where.coachAssignments = {
        some: activeAssignmentWhere(now),
      };
    } else if (hasCoach === 'false') {
      where.coachAssignments = {
        none: activeAssignmentWhere(now),
      };
    }

    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Fetch students with pagination
    const [students, total] = await Promise.all([
      prisma.student.findMany({
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
              activatedAt: true,
            },
          },
          parent: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          coachAssignments: {
            where: activeAssignmentWhere(now),
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
          subscriptions: {
            where: { status: 'ACTIVE' },
            take: 1,
          },
          _count: {
            select: {
              coachAssignments: true,
              sessions: true,
            },
          },
        },
      }),
      prisma.student.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      pagination: createPaginationMeta(page, limit, total),
      students,
    });
  } catch (error) {
    console.error('[API Assistante Students GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la récupération des élèves' },
      { status: 500 }
    );
  }
}
