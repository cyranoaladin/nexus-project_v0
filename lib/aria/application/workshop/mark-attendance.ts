/**
 * Staff marks real attendance on a real ARIA collective workshop
 * registration (P7d) — the only way this state changes; no manual SQL.
 */
import { prisma } from '@/lib/prisma';
import { AriaError } from '../../errors';
import { resolveInteractiveStaffActor } from '../../kernel/staff-subject';

const MARKABLE_STATUSES = Object.freeze(['ATTENDED', 'ABSENT'] as const);
export type AriaWorkshopAttendanceMark = typeof MARKABLE_STATUSES[number];

export async function markAriaWorkshopAttendance(input: {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly attendeeId: string;
  readonly status: AriaWorkshopAttendanceMark;
}): Promise<{ readonly status: AriaWorkshopAttendanceMark }> {
  const actor = resolveInteractiveStaffActor(input.actor);

  if (!MARKABLE_STATUSES.includes(input.status)) {
    throw new AriaError('BAD_REQUEST', 400, 'Statut de présence invalide.');
  }

  const attendee = await prisma.ariaWorkshopAttendee.findUnique({ where: { id: input.attendeeId } });
  if (!attendee) {
    throw new AriaError('BAD_REQUEST', 404, 'Inscription introuvable.');
  }

  await prisma.ariaWorkshopAttendee.update({
    where: { id: input.attendeeId },
    data: {
      status: input.status,
      attendanceMarkedAt: new Date(),
      attendanceMarkedById: actor.userId,
    },
  });
  return Object.freeze({ status: input.status });
}
