import { coachCapableCourseKeys } from '@/lib/assignments/allowed-courses';
import { getCourse,isKnownCourseKey } from '@/lib/curriculum/catalog';
import { listFollowedCourses,listStudentEnrollments,resolveStudentCourses } from '@/lib/curriculum/enrollment';
import { isErrorResponse,requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';
import { parseSubjects } from '@/lib/utils/subjects';
import { serializeError } from '@/lib/utils/serialize-error';
import { AssignmentStatus,type Subject } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * `courseKeys` remplace `subjects` en entrée : même règle qu'à la création,
 * `subjects` n'est jamais accepté du client, seulement dérivé côté serveur
 * quand `courseKeys` est fourni (voir POST /api/assistante/assignments).
 * Absent = périmètre académique inchangé.
 */
const updateAssignmentSchema = z.object({
  status: z.nativeEnum(AssignmentStatus).optional(),
  courseKeys: z.array(z.string().min(1)).optional(),
  notes: z.string().optional(),
  endsAt: z.string().datetime().optional().nullable(),
});

function deriveLegacySubjects(courseKeys: readonly string[]): Subject[] {
  const subjects = new Set<Subject>();
  for (const courseKey of courseKeys) {
    const course = getCourse(courseKey);
    if (course?.legacySubject) subjects.add(course.legacySubject as Subject);
  }
  return [...subjects];
}

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

    // Check if assignment exists — reload coach + student pour valider un
    // éventuel changement de périmètre de cours (jamais depuis l'ancienne
    // ligne persistée : le périmètre suivi/capable peut avoir changé depuis).
    const existingAssignment = await prisma.coachStudentAssignment.findUnique({
      where: { id },
      include: {
        coach: { select: { subjects: true } },
        student: { select: { id: true, gradeLevel: true, academicTrack: true, stmgPathway: true } },
      },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Assignation non trouvée' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: import('@prisma/client').Prisma.CoachStudentAssignmentUpdateInput = {
      updatedAt: new Date(),
    };

    if (validated.status !== undefined) {
      updateData.status = validated.status;
    }

    if (validated.courseKeys !== undefined) {
      const uniqueCourseKeys = [...new Set(validated.courseKeys)];

      const enrollments = await listStudentEnrollments(existingAssignment.student.id);
      const followedViews = listFollowedCourses(
        resolveStudentCourses(
          {
            gradeLevel: existingAssignment.student.gradeLevel,
            academicTrack: existingAssignment.student.academicTrack,
            stmgPathway: existingAssignment.student.stmgPathway,
          },
          enrollments,
        ),
      );
      const followedKeys = new Set(followedViews.map((view) => view.course.courseKey));
      const coachCapableKeys = coachCapableCourseKeys(parseSubjects(existingAssignment.coach.subjects));

      for (const courseKey of uniqueCourseKeys) {
        if (!isKnownCourseKey(courseKey)) {
          return NextResponse.json(
            { error: 'UNKNOWN_COURSE_KEY', message: `Cours inconnu du catalogue: ${courseKey}` },
            { status: 400 },
          );
        }
        if (!followedKeys.has(courseKey)) {
          return NextResponse.json(
            { error: 'COURSE_NOT_FOLLOWED', message: `L'élève ne suit pas actuellement le cours ${courseKey}` },
            { status: 400 },
          );
        }
        if (!coachCapableKeys.has(courseKey)) {
          return NextResponse.json(
            { error: 'COURSE_NOT_COACH_CAPABLE', message: `Le coach n'est pas déclaré capable d'enseigner le cours ${courseKey}` },
            { status: 400 },
          );
        }
      }

      updateData.academicCourseKeys = uniqueCourseKeys;
      updateData.courseScopeState = 'STAFF_VERIFIED';
      updateData.subjects = deriveLegacySubjects(uniqueCourseKeys);
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
