/**
 * A real, eligible student registers for a real ARIA collective workshop
 * (P7d). Eligibility is re-derived from the session's own real courseKey
 * (never trusted from client input) — the exact same gate
 * `listAriaWorkshopsForActor` already used to decide whether to even show
 * this session, so a student can never register for a workshop they were
 * never shown.
 */
import { prisma } from '@/lib/prisma';
import { AriaError } from '../../errors';
import { authorizeWorkshopCourseForActor, type AriaWorkshopActorInput } from './authorize';

export async function registerForAriaWorkshop(
  input: AriaWorkshopActorInput & { readonly workshopSessionId: string },
): Promise<{ readonly status: 'REGISTERED' }> {
  const session = await prisma.ariaWorkshopSession.findUnique({
    where: { id: input.workshopSessionId },
    select: { id: true, courseKey: true, status: true, capacity: true, _count: { select: { attendees: true } } },
  });
  // Same shape whether the session doesn't exist or belongs to a course
  // this actor was never authorized for — resolved by authorizing against
  // the session's OWN real courseKey below, never revealing which.
  if (!session || session.status !== 'SCHEDULED') {
    throw new AriaError('BAD_REQUEST', 404, 'Atelier introuvable.');
  }

  const { student } = await authorizeWorkshopCourseForActor({ ...input, courseKey: session.courseKey });

  const existing = await prisma.ariaWorkshopAttendee.findUnique({
    where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
  });
  if (existing) return Object.freeze({ status: 'REGISTERED' as const });

  if (session.capacity !== null && session._count.attendees >= session.capacity) {
    throw new AriaError('BAD_REQUEST', 409, 'Cet atelier est complet.', { reasonCode: 'ARIA_WORKSHOP_FULL' });
  }

  await prisma.ariaWorkshopAttendee.create({
    data: { sessionId: session.id, studentId: student.id, status: 'REGISTERED' },
  });
  return Object.freeze({ status: 'REGISTERED' as const });
}
