import type { Prisma } from '@/core-v2/generated/client';
import { lockInvitationAuthority } from '../accounts/invitation-scope';
import { appendAuditEvent } from '../audit';
import { InvalidStateError, NotFoundError } from '../errors';
import type { ServiceContext, Tx } from '../services/context';

/** Current dossier authority is an assignment, never a historical booking. */
export function currentCoachAssignmentWhere(at: Date): Prisma.CoachStudentCourseAssignmentWhereInput {
  return { status: 'ACTIVE', startsAt: { lte: at }, OR: [{ endsAt: null }, { endsAt: { gt: at } }],
    academicYearEnrollment: { status: 'ACTIVE', academicYear: { status: { in: ['CURRENT', 'UPCOMING'] } },
      student: { user: { role: 'ELEVE', accountStatus: 'ACTIVE' } } } };
}

/** Global authority first, then assignment: same order as planning and withdrawal. */
export async function lockCoachAssignment(tx: Tx, assignmentId: string): Promise<void> {
  await lockInvitationAuthority(tx);
  await tx.$queryRaw`SELECT id FROM public.coach_student_course_assignments WHERE id = ${assignmentId} FOR UPDATE`;
}

/** One atomic closure for explicit termination and enrollment withdrawal. */
export async function closeCoachAssignment(tx: Tx, ctx: ServiceContext, assignmentId: string,
  metadata: Readonly<Record<string, string>> = {}, lockedAt?: Date) {
  await lockCoachAssignment(tx, assignmentId);
  const at = lockedAt ?? ctx.now();
  const moved = await tx.coachStudentCourseAssignment.updateMany({ where: { id: assignmentId, status: 'ACTIVE' },
    data: { status: 'ENDED', endsAt: at } });
  if (moved.count !== 1) {
    const current = await tx.coachStudentCourseAssignment.findUnique({ where: { id: assignmentId } });
    if (!current) throw new NotFoundError('Assignment not found.', { assignmentId });
    throw new InvalidStateError('Only an ACTIVE assignment can be ended.', { assignmentId, status: current.status });
  }
  const series = await tx.planningSeries.updateMany({ where: { assignmentId, status: { in: ['ACTIVE', 'PAUSED'] } },
    data: { status: 'ENDED', revision: { increment: 1 } } });
  // Includes overrides detached from their original series. Past/in-progress
  // and already delivered rows are preserved; none grant a current dossier.
  const bookings = await tx.sessionBooking.updateMany({ where: { assignmentId, startsAt: { gt: at },
    status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] } }, data: { status: 'CANCELLED', cancelledAt: at } });
  await appendAuditEvent(tx, { actorUserId: ctx.actor.userId, action: 'coach.assignment_ended',
    subjectType: 'CoachStudentCourseAssignment', subjectId: assignmentId, correlationId: ctx.correlationId,
    metadata: { ...metadata, endedPlanningSeries: series.count, cancelledFutureBookings: bookings.count } });
  return tx.coachStudentCourseAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
}
