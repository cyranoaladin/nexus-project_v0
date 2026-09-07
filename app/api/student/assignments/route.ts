export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { activeAssignmentWhere } from '@/lib/rbac/coach-student-access';
import { courseLabel } from '@/lib/curriculum/catalog';
import { serializeError } from '@/lib/utils/serialize-error';

/**
 * GET /api/student/assignments — lecture seule des propres assignations
 * ACTIVE de l'appelant ELEVE (Tâche 12, correctif suivi).
 *
 * Remplace le flux "parcourir n'importe quel coach par matière"
 * (`GET /api/coaches/available`) qu'utilisait encore
 * `components/ui/session-booking.tsx` : un élève ne réserve désormais
 * qu'avec un coach auquel il est RÉELLEMENT assigné
 * (`CoachStudentAssignment`, seule source de vérité — Tâche 9), jamais un
 * choix libre.
 *
 * Seules les assignations dont le périmètre de cours est RÉSOLU
 * (`STAFF_VERIFIED` ou `BACKFILL_AUTO` — `lib/assignments/allowed-courses.ts`)
 * sont renvoyées : une assignation `BACKFILL_UNRESOLVED`/`BACKFILL_AMBIGUOUS`
 * n'a aucun `academicCourseKey` exploitable par un élève pour réserver.
 *
 * Renvoie aussi le `Student.id` canonique de l'appelant (jamais son
 * `User.id`), pour éviter un second aller-retour au composant appelant avant
 * de poser `POST /api/sessions/book`.
 *
 * Lecture seule — aucune nouvelle capacité de mutation.
 */
export async function GET(_req: NextRequest) {
  const sessionOrError = await requireRole(UserRole.ELEVE);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const session = sessionOrError;

  try {
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    const assignments = await prisma.coachStudentAssignment.findMany({
      where: {
        studentId: student.id,
        courseScopeState: { in: ['STAFF_VERIFIED', 'BACKFILL_AUTO'] },
        ...activeAssignmentWhere(),
      },
      include: {
        coach: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = assignments
      .filter((assignment) => assignment.academicCourseKeys.length > 0)
      .map((assignment) => ({
        id: assignment.id,
        coachProfileId: assignment.coachId,
        coachUserId: assignment.coach.userId,
        coachName: `${assignment.coach.user.firstName} ${assignment.coach.user.lastName}`.trim(),
        coachPseudonym: assignment.coach.pseudonym,
        academicCourseKeys: assignment.academicCourseKeys.map((courseKey) => ({
          courseKey,
          label: courseLabel(courseKey),
        })),
      }));

    return NextResponse.json({
      success: true,
      studentId: student.id,
      assignments: formatted,
    });
  } catch (err) {
    console.error('[student/assignments] failed', serializeError(err));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
