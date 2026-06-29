import { NextResponse } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { AssignmentStatus, Subject } from '@prisma/client';
import { z } from 'zod';
import { serializeError } from '@/lib/utils/serialize-error';

// Validation schema for updating assignments
const updateAssignmentSchema = z.object({
  status: z.nativeEnum(AssignmentStatus).optional(),
  subjects: z.array(z.nativeEnum(Subject)).optional(),
  notes: z.string().optional(),
  endsAt: z.string().datetime().optional().nullable(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/assistante/assignments/[id]
 *
 * Returns details of a specific assignment.
 * Requires: ASSISTANTE or ADMIN role
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const session = sessionOrError;

    // RBAC check: READ permission on COACH_ASSIGNMENT
    if (!can(session.user.role, 'READ', 'COACH_ASSIGNMENT')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Permission insuffisante' },
        { status: 403 }
      );
    }

    const assignment = await prisma.coachStudentAssignment.findUnique({
      where: { id },
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
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Assignation non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      assignment,
    });
  } catch (error) {
    console.error('[API Assistante Assignment GET] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/assistante/assignments/[id]
 *
 * Updates an assignment (suspend, end, or modify).
 * Requires: ASSISTANTE or ADMIN role with ASSIGN/UNASSIGN permission
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    if (!can(sessionOrError.user.role, 'ASSIGN', 'COACH_ASSIGNMENT') &&
        !can(sessionOrError.user.role, 'UNASSIGN', 'COACH_ASSIGNMENT')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Permission insuffisante' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = updateAssignmentSchema.parse(body);

    // Check if assignment exists
    const existingAssignment = await prisma.coachStudentAssignment.findUnique({
      where: { id },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Assignation non trouvée' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (validated.status !== undefined) {
      updateData.status = validated.status;
    }

    if (validated.subjects !== undefined) {
      updateData.subjects = validated.subjects;
    }

    if (validated.notes !== undefined) {
      updateData.notes = validated.notes;
    }

    // Handle endsAt with priority rule: if status is ENDED, endsAt must be set
    if (validated.status === AssignmentStatus.ENDED) {
      // Force endsAt to now when ending, even if client sends null
      updateData.endsAt = validated.endsAt
        ? new Date(validated.endsAt)
        : new Date();
    } else if (validated.endsAt !== undefined) {
      updateData.endsAt = validated.endsAt ? new Date(validated.endsAt) : null;
    }

    const updatedAssignment = await prisma.coachStudentAssignment.update({
      where: { id },
      data: updateData,
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
        student: {
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
    });

    return NextResponse.json({
      success: true,
      message: 'Assignation mise à jour',
      assignment: updatedAssignment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation Error', message: error.errors },
        { status: 400 }
      );
    }

    console.error('[API Assistante Assignment PATCH] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}
