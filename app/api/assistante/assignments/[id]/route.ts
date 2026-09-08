import { coachCapableCourseKeys } from '@/lib/assignments/allowed-courses';
import { getCourse,isKnownCourseKey } from '@/lib/curriculum/catalog';
import { listFollowedCourses,listStudentEnrollments,resolveStudentCourses } from '@/lib/curriculum/enrollment';
import { isErrorResponse,requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';
import { parseSubjects } from '@/lib/utils/subjects';
import { serializeError } from '@/lib/utils/serialize-error';
import { AssignmentStatus,Prisma,type Subject } from '@prisma/client';
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
  courseKeys: z.array(z.string().min(1)).min(1, 'Au moins un cours requis').optional(),
  notes: z.string().optional(),
  endsAt: z.string().datetime().optional().nullable(),
}).strict();

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

    return await prisma.$transaction(async (tx) => {
      const now = new Date();
      // Check if assignment exists — reload coach + student pour valider un
      // éventuel changement de périmètre de cours (jamais depuis l'ancienne
      // ligne persistée : le périmètre suivi/capable peut avoir changé depuis).
      const existingAssignment = await tx.coachStudentAssignment.findUnique({
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

      const ended = existingAssignment.status === AssignmentStatus.ENDED;
      const expired = existingAssignment.endsAt !== null && existingAssignment.endsAt < now;
      const requestedEnd = validated.endsAt ? new Date(validated.endsAt) : null;
      const endChanged = validated.endsAt !== undefined &&
        requestedEnd?.getTime() !== existingAssignment.endsAt?.getTime();
      // Terminal authority is immutable. Notes and idempotent closure remain
      // available even when a historical scope is no longer valid today.
      if ((ended || expired) && (
        validated.courseKeys !== undefined || endChanged ||
        (validated.status !== undefined && validated.status !== AssignmentStatus.ENDED)
      ) || (validated.status === AssignmentStatus.ENDED && validated.courseKeys !== undefined)) {
        return NextResponse.json(
          { error: 'ASSIGNMENT_HISTORY_IMMUTABLE', message: 'Le périmètre et la fin d’une assignation terminée ou expirée sont conservés' },
          { status: 409 },
        );
      }
      if (!ended && !expired && requestedEnd &&
          (requestedEnd <= existingAssignment.startsAt || requestedEnd <= now)) {
        return NextResponse.json(
          { error: 'INVALID_ASSIGNMENT_DATES', message: 'La fin doit être postérieure au début et à la date actuelle' },
          { status: 400 },
        );
      }
      const effectiveEnd = validated.endsAt === undefined ? existingAssignment.endsAt : requestedEnd;
      if (validated.status === AssignmentStatus.ACTIVE && effectiveEnd &&
          (effectiveEnd <= existingAssignment.startsAt || effectiveEnd <= now)) {
        return NextResponse.json(
          { error: 'INVALID_ASSIGNMENT_DATES', message: 'La fenêtre de l’assignation doit être valide avant activation' },
          { status: 400 },
        );
      }

      // Build update data
      const updateData: Prisma.CoachStudentAssignmentUpdateInput = {
        updatedAt: now,
      };

      if (validated.status !== undefined) {
        updateData.status = validated.status;
      }

      if (validated.courseKeys !== undefined || validated.status === AssignmentStatus.ACTIVE) {
        const uniqueCourseKeys = [...new Set(validated.courseKeys ?? existingAssignment.academicCourseKeys)];
        if (uniqueCourseKeys.length === 0 || (validated.courseKeys === undefined &&
            !['STAFF_VERIFIED', 'BACKFILL_AUTO'].includes(existingAssignment.courseScopeState))) {
          return NextResponse.json(
            { error: 'INVALID_COURSE_SCOPE', message: 'Un périmètre de cours non vide et vérifié est requis avant activation' },
            { status: 400 },
          );
        }

        const enrollments = await listStudentEnrollments(existingAssignment.student.id, tx);
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

        if (validated.courseKeys !== undefined) {
          updateData.academicCourseKeys = uniqueCourseKeys;
          updateData.courseScopeState = 'STAFF_VERIFIED';
          updateData.subjects = deriveLegacySubjects(uniqueCourseKeys);
        }
      }

      if (validated.status === AssignmentStatus.ACTIVE) {
        const duplicates = await tx.coachStudentAssignment.findMany({
          where: {
            id: { not: id }, coachId: existingAssignment.coachId,
            studentId: existingAssignment.studentId, status: AssignmentStatus.ACTIVE,
          },
          select: { id: true },
        });
        if (duplicates.length > 0) {
          return NextResponse.json(
            { error: 'Conflict', message: 'Une assignation active existe déjà pour ce coach et cet élève' },
            { status: 409 },
          );
        }
      }

      if (validated.notes !== undefined) {
        updateData.notes = validated.notes;
      }

      if (!ended && !expired) {
        if (validated.status === AssignmentStatus.ENDED) {
          // Immediate closure also permits cancelling an assignment not yet started.
          updateData.endsAt = requestedEnd ?? now;
        } else if (validated.endsAt !== undefined) {
          updateData.endsAt = requestedEnd;
        }
      }

      const updatedAssignment = await tx.coachStudentAssignment.update({
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation Error', message: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      return NextResponse.json(
        { error: 'Conflict', message: 'Conflit d’assignation, rechargez les données avant de réessayer' },
        { status: 409 },
      );
    }

    console.error('[API Assistante Assignment PATCH] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}
