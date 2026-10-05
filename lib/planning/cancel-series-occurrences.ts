import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ACTIVE_BOOKING_STATUSES } from './invariants';

export class PlanningSeriesCancellationConflictError extends Error {
  constructor() { super('Une occurrence active a changé : rechargez le planning.'); this.name = 'PlanningSeriesCancellationConflictError'; }
}

/** Caller owns the transaction; any failed audit rolls back every cancellation. */
export async function cancelSeriesOccurrences(tx: Prisma.TransactionClient, input: {
  seriesId: string; boundary: Date; actorUserId: string; actorRole: string;
  action: 'SERIES_CANCELLED' | 'SERIES_REVISED'; reason: string;
}): Promise<number> {
  const future = { planningSeriesId: input.seriesId, scheduledDate: { gte: input.boundary }, status: { in: [...ACTIVE_BOOKING_STATUSES] } };
  const bookings = await tx.sessionBooking.findMany({ where: future, select: { id: true, status: true, studentId: true, coachId: true }, orderBy: { id: 'asc' } });
  const operationId = randomUUID();
  let count = 0;
  for (const booking of bookings) {
    const changed = await tx.sessionBooking.updateMany({
      where: { ...future, id: booking.id, studentId: booking.studentId, coachId: booking.coachId, AND: { status: booking.status } },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    if (changed.count === 0) {
      const current = await tx.sessionBooking.findUnique({ where: { id: booking.id }, select: { status: true } });
      if (current && ACTIVE_BOOKING_STATUSES.includes(current.status)) throw new PlanningSeriesCancellationConflictError();
      continue;
    }
    await tx.sessionBookingCancellationAudit.create({ data: {
      sessionBookingId: booking.id, actorUserId: input.actorUserId, actorRole: input.actorRole,
      requestKey: `series-cancel:v1:${operationId}:${booking.id}`, action: input.action,
      previousStatus: booking.status, nextStatus: 'CANCELLED', reason: input.reason,
    } });
    count += changed.count;
  }
  return count;
}
