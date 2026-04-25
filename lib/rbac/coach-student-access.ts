import { prisma } from '@/lib/prisma';

/**
 * Phase 6 — RBAC helper: does the given coach have any pedagogical link
 * with the given student?
 *
 * A coach is authorized to access a student's dossier and write notes
 * if and only if at least one SessionBooking exists between them.
 * Admins bypass this check (handled by the caller).
 *
 * @param coachUserId   User.id of the coach (session.user.id)
 * @param studentUserId User.id of the student (URL param)
 * @returns true if the coach is rattached to the student
 */
export async function isCoachRattachedToStudent(
  coachUserId: string,
  studentUserId: string,
): Promise<boolean> {
  if (!coachUserId || !studentUserId) return false;
  const link = await prisma.sessionBooking.findFirst({
    where: { coachId: coachUserId, studentId: studentUserId },
    select: { id: true },
  });
  return Boolean(link);
}
