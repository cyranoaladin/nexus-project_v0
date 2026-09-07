import { prisma } from '@/lib/prisma';
import { AssignmentStatus, Prisma } from '@prisma/client';

/**
 * Error class for coach-student access denial
 * Allows routes to distinguish between "not assigned" (403) and other errors (500)
 */
export class CoachNotAssignedError extends Error {
  constructor(message = "Vous n'êtes pas assigné à cet élève") {
    super(message);
    this.name = 'CoachNotAssignedError';
  }
}

/**
 * Build the where clause for active assignments
 * Centralizes the logic: ACTIVE status + started + not ended
 */
export function activeAssignmentWhere(now: Date = new Date()): Prisma.CoachStudentAssignmentWhereInput {
  return {
    status: AssignmentStatus.ACTIVE,
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gte: now } }],
  };
}

/**
 * Get CoachProfile for a given user ID
 * Returns null if user is not a coach
 */
export async function getCoachProfileForUser(userId: string) {
  if (!userId) return null;
  return prisma.coachProfile.findUnique({
    where: { userId },
  });
}

/**
 * Resolve a route reference that may be either Student.id or User.id.
 *
 * Cette ambiguïté n'est PAS un oubli : le seul appelant réel de cette
 * fonction (`app/api/coach/students/[studentId]/eaf-preparation-report/
 * route.ts` et son `.../validate/route.ts`) est nourri par
 * `StudentDossier.tsx` (`EafPreparationReport studentId={student.studentId}`)
 * avec le `Student.id` canonique renvoyé explicitement par
 * `GET /api/coach/students/[studentId]/dossier` depuis la Tâche 14
 * (`student.studentId`, distinct de `student.studentUserId` = `User.id`).
 * La tolérance User.id est conservée en défense (compat. historique/appelants
 * externes), confirmée par le test
 * `__tests__/api/coach/eaf-preparation-report.test.ts` (« canonicalizes a
 * User id to Student.id before persisting the report »). Elle ne sert jamais
 * à élargir un accès : ses deux appelants passent le `Student.id` résolu à
 * `assertCoachCanAccessStudent`, qui reste la seule porte d'autorisation.
 */
export async function resolveStudentProfileId(studentReference: string): Promise<string | null> {
  if (!studentReference) return null;

  const student = await prisma.student.findFirst({
    where: {
      OR: [
        { id: studentReference },
        { userId: studentReference },
      ],
    },
    select: { id: true },
  });

  return student?.id ?? null;
}

/**
 * Check if a coach is assigned to a student via CoachStudentAssignment
 * (SEULE source de vérité des relations coach-élève : aucun repli
 * `SessionBooking` — une séance passée ne fonde jamais un accès dossier).
 *
 * @param coachUserId   User.id of the coach (session.user.id)
 * @param studentId     Student.id (not User.id) — résolution canonique
 *                       stricte, jamais d'OR avec `student.userId`.
 * @returns true if active assignment exists
 */
export async function isCoachAssignedToStudent({
  coachUserId,
  studentId,
}: {
  coachUserId: string;
  studentId: string;
}): Promise<boolean> {
  if (!coachUserId || !studentId) return false;

  const coachProfile = await getCoachProfileForUser(coachUserId);
  if (!coachProfile) return false;

  const now = new Date();
  const assignment = await prisma.coachStudentAssignment.findFirst({
    where: {
      coachId: coachProfile.id,
      studentId,
      ...activeAssignmentWhere(now),
    },
    select: { id: true },
  });

  return Boolean(assignment);
}

/**
 * Assert that a coach can access a student, throw otherwise
 * Use this in API routes for strict ownership enforcement
 *
 * @throws Error with 403 message if not assigned
 */
export async function assertCoachCanAccessStudent({
  coachUserId,
  studentId,
}: {
  coachUserId: string;
  studentId: string;
}): Promise<void> {
  const hasAccess = await isCoachAssignedToStudent({ coachUserId, studentId });
  if (!hasAccess) {
    throw new CoachNotAssignedError();
  }
}

/**
 * Get all students assigned to a coach
 * Returns enriched student data for coach dashboard
 *
 * @param coachUserId User.id of the coach
 * @returns Array of assigned students with assignment metadata
 */
export async function getAssignedStudentsForCoach({
  coachUserId,
}: {
  coachUserId: string;
}) {
  if (!coachUserId) return [];

  const coachProfile = await getCoachProfileForUser(coachUserId);
  if (!coachProfile) return [];

  const now = new Date();
  const assignments = await prisma.coachStudentAssignment.findMany({
    where: {
      coachId: coachProfile.id,
      ...activeAssignmentWhere(now),
    },
    include: {
      student: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          parent: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          _count: {
            select: {
              sessions: true,
              assessments: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return assignments.map((assignment: any) => ({
    assignmentId: assignment.id,
    assignmentType: assignment.assignmentType,
    subjects: assignment.subjects,
    notes: assignment.notes,
    startsAt: assignment.startsAt,
    endsAt: assignment.endsAt,
    student: {
      id: assignment.student.id,
      userId: assignment.student.userId,
      firstName: assignment.student.user?.firstName,
      lastName: assignment.student.user?.lastName,
      email: assignment.student.user?.email,
      parentName: assignment.student.parent?.user
        ? `${assignment.student.parent.user.firstName || ''} ${assignment.student.parent.user.lastName || ''}`.trim()
        : null,
      gradeLevel: assignment.student.gradeLevel,
      academicTrack: assignment.student.academicTrack,
      specialties: assignment.student.specialties,
      stmgPathway: assignment.student.stmgPathway,
      survivalMode: assignment.student.survivalMode,
      school: assignment.student.school,
      stats: {
        sessionsCount: assignment.student._count?.sessions || 0,
        assessmentsCount: assignment.student._count?.assessments || 0,
      },
    },
  }));
}
