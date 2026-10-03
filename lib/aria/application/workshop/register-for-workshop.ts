/** Serialized workshop admission with a notification intent committed atomically. */
import { prisma } from '@/lib/prisma';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { AriaError } from '../../errors';
import { enqueueParentWorkshopRegistered } from '../../notifications/notify-parent-workshop-registered';
import { authorizeWorkshopCourseForActor, type AriaWorkshopActorInput } from './authorize';

export async function registerForAriaWorkshop(
  input: AriaWorkshopActorInput & { readonly workshopSessionId: string },
): Promise<{ readonly status: 'REGISTERED' }> {
  const initial = await prisma.ariaWorkshopSession.findUnique({
    where: { id: input.workshopSessionId }, select: { courseKey: true, status: true },
  });
  if (!initial || initial.status !== 'SCHEDULED') {
    throw new AriaError('BAD_REQUEST', 404, 'Atelier introuvable.');
  }
  const { student } = await authorizeWorkshopCourseForActor({ ...input, courseKey: initial.courseKey });
  const created = await prisma.$transaction(async transaction => {
    // This lock also serializes with session cancellation/capacity updates.
    await transaction.$queryRaw`SELECT id FROM aria_workshop_sessions WHERE id=${input.workshopSessionId} FOR NO KEY UPDATE`;
    const session = await transaction.ariaWorkshopSession.findUnique({ where: { id: input.workshopSessionId } });
    if (!session || session.status !== 'SCHEDULED' || session.courseKey !== initial.courseKey) {
      throw new AriaError('BAD_REQUEST', 404, 'Atelier introuvable.');
    }
    const existing = await transaction.ariaWorkshopAttendee.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
    });
    if (existing) return false;
    const count = await transaction.ariaWorkshopAttendee.count({ where: { sessionId: session.id } });
    if (session.capacity !== null && count >= session.capacity) {
      throw new AriaError('BAD_REQUEST', 409, 'Cet atelier est complet.', { reasonCode: 'ARIA_WORKSHOP_FULL' });
    }
    await transaction.ariaWorkshopAttendee.create({ data: { sessionId: session.id, studentId: student.id, status: 'REGISTERED' } });
    await enqueueParentWorkshopRegistered(transaction, {
      studentId: student.id, sessionId: session.id, workshopTitle: session.title,
      scheduledDate: session.scheduledDate, startTime: session.startTime,
      endTime: session.endTime, location: session.location,
    });
    return true;
  }, { isolationLevel: 'ReadCommitted' });
  // An unavailable provider cannot undo admission: its encrypted intent is durable.
  if (created) kickEmailOutboxDrain();
  return Object.freeze({ status: 'REGISTERED' as const });
}
