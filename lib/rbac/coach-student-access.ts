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
 * Check if a coach is assigned to a student via CoachStudentAssignment
 * (New source of truth for coach-student relationships)
 *
 * @param coachUserId   User.id of the coach (session.user.id)
 * @param studentId     Student.id (not User.id)
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
      AND: [
        {
          OR: [
            { studentId: studentId },
            { student: { userId: studentId } }
          ],
        },
        activeAssignmentWhere(now),
      ],
    },
    select: { id: true },
  });

  if (assignment) return true;

  // Fallback: Check if there's any completed or upcoming session booking for this student with this coach
  const sessionBooking = await prisma.sessionBooking.findFirst({
    where: {
      OR: [
        { studentId: studentId },
        { student: { student: { id: studentId } } } // If studentId passed was Student profile ID
      ],
      coachId: coachUserId,
      status: { in: ['COMPLETED', 'CONFIRMED'] },
    },
    select: { id: true },
  });

  return Boolean(sessionBooking);
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
      credits: assignment.student.credits,
      stats: {
        sessionsCount: assignment.student._count?.sessions || 0,
        assessmentsCount: assignment.student._count?.assessments || 0,
      },
    },
  }));
}

/**
 * Legacy compatibility: Check via SessionBooking (fallback)
 * Kept for backward compatibility during migration period
 *
 * @deprecated Use isCoachAssignedToStudent instead
 */
export async function isCoachRattachedToStudent(
  coachUserId: string,
  studentUserId: string,
): Promise<boolean> {
  if (!coachUserId || !studentUserId) return false;

  // First check new CoachStudentAssignment system
  const student = await prisma.student.findUnique({
    where: { userId: studentUserId },
    select: { id: true },
  });

  if (student) {
    const hasAssignment = await isCoachAssignedToStudent({
      coachUserId,
      studentId: student.id,
    });
    if (hasAssignment) return true;
  }

  // Fallback to legacy SessionBooking check
  const link = await prisma.sessionBooking.findFirst({
    where: { coachId: coachUserId, studentId: studentUserId },
    select: { id: true },
  });
  return Boolean(link);
}
