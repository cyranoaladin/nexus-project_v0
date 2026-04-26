import { NextResponse } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AssignmentType, AssignmentStatus, Subject, Prisma } from '@prisma/client';
import { z } from 'zod';
import { parsePagination, createPaginationMeta } from '@/lib/api/pagination';

// Validation schema for query parameters
const statusQuerySchema = z.nativeEnum(AssignmentStatus).optional().default(AssignmentStatus.ACTIVE);

// Validation schema for creating assignments
// Deduplicates studentIds automatically
const createAssignmentSchema = z.object({
  coachId: z.string().min(1, 'Coach ID requis'),
  studentIds: z.array(z.string().min(1))
    .min(1, 'Au moins un élève requis')
    .transform((ids) => Array.from(new Set(ids)))
    .refine((ids) => ids.length > 0, 'Au moins un élève unique requis'),
  assignmentType: z.nativeEnum(AssignmentType).default(AssignmentType.PRIMARY),
  subjects: z.array(z.nativeEnum(Subject)).optional().default([]),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/assistante/assignments
 *
 * Returns a list of coach-student assignments.
 * Requires: ASSISTANTE or ADMIN role
 * Query params:
 *   - coachId: string (filter by coach)
 *   - studentId: string (filter by student)
 *   - status: AssignmentStatus (default: ACTIVE)
 *   - page: number (default: 1)
 *   - limit: number (default: 20, max: 100)
 */
export async function GET(request: Request) {
  try {
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const session = sessionOrError;

    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const studentId = searchParams.get('studentId');

    // Validate status parameter with Zod
    const statusResult = statusQuerySchema.safeParse(searchParams.get('status'));
    if (!statusResult.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Statut invalide' },
        { status: 400 }
      );
    }
    const status = statusResult.data;

    const { page, limit, skip } = parsePagination(searchParams);

    const where: any = {};
    if (coachId) where.coachId = coachId;
    if (studentId) where.studentId = studentId;
    if (status) where.status = status;

    const [assignments, total] = await Promise.all([
      prisma.coachStudentAssignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          coach: {
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
          student: {
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
          assignedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.coachStudentAssignment.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      pagination: createPaginationMeta(page, limit, total),
      assignments,
    });
  } catch (error) {
    console.error('[API Assistante Assignments GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/assistante/assignments
 *
 * Creates one or multiple coach-student assignments.
 * Requires: ASSISTANTE or ADMIN role with ASSIGN permission
 */
export async function POST(request: Request) {
  try {
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const session = sessionOrError;

    if (!can(session.user.role, 'ASSIGN', 'COACH_ASSIGNMENT')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Permission insuffisante pour créer des assignations' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = createAssignmentSchema.parse(body);

    // Verify coach exists
    const coach = await prisma.coachProfile.findUnique({
      where: { id: validated.coachId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    if (!coach) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Coach non trouvé' },
        { status: 400 }
      );
    }

    // Verify all students exist
    const students = await prisma.student.findMany({
      where: { id: { in: validated.studentIds } },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    if (students.length !== validated.studentIds.length) {
      const foundIds = students.map((s) => s.id);
      const missingIds = validated.studentIds.filter((id) => !foundIds.includes(id));
      return NextResponse.json(
        { error: 'Bad Request', message: `Élèves non trouvés: ${missingIds.join(', ')}` },
        { status: 400 }
      );
    }

    // Check for existing active assignments using active window (prevent duplicates)
    const now = new Date();
    const { activeAssignmentWhere } = await import('@/lib/rbac/coach-student-access');
    const existingAssignments = await prisma.coachStudentAssignment.findMany({
      where: {
        coachId: validated.coachId,
        studentId: { in: validated.studentIds },
        ...activeAssignmentWhere(now),
      },
    });

    const existingStudentIds = existingAssignments.map((a) => a.studentId);

    // If trying to create PRIMARY assignment where one already exists, reject
    if (validated.assignmentType === AssignmentType.PRIMARY && existingStudentIds.length > 0) {
      const existingStudents = students.filter((s) => existingStudentIds.includes(s.id));
      return NextResponse.json(
        {
          error: 'Conflict',
          message: `Ces élèves ont déjà une assignation active avec ce coach: ${existingStudents.map((s) => `${s.user.firstName} ${s.user.lastName}`).join(', ')}`,
        },
        { status: 409 }
      );
    }

    // Create assignments in a transaction
    const createdAssignments = await prisma.$transaction(
      validated.studentIds.map((studentId) =>
        prisma.coachStudentAssignment.create({
          data: {
            coachId: validated.coachId,
            studentId,
            assignedById: session.user.id,
            assignmentType: validated.assignmentType,
            subjects: validated.subjects,
            notes: validated.notes,
            startsAt: validated.startsAt ? new Date(validated.startsAt) : new Date(),
            endsAt: validated.endsAt ? new Date(validated.endsAt) : null,
            status: AssignmentStatus.ACTIVE,
          },
          include: {
            coach: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
            student: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        })
      )
    );

    return NextResponse.json(
      {
        success: true,
        message: `${createdAssignments.length} assignation(s) créée(s)`,
        assignments: createdAssignments,
      },
      { status: 201 }
    );
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation Error', message: error.errors },
        { status: 400 }
      );
    }

    // Handle Prisma unique constraint violation (P2002)
    // This can happen due to the partial unique index on active assignments
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'Conflict',
          message: 'Une assignation active existe déjà pour cette combinaison coach/élève/type',
        },
        { status: 409 }
      );
    }

    console.error('[API Assistante Assignments POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}
