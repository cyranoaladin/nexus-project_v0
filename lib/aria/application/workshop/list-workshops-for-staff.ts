/**
 * Real ARIA collective workshops + their real roster, for the staff
 * cockpit that schedules them and marks attendance (P7d) — no manual
 * SQL/script required to operate this capability.
 */
import { prisma } from '@/lib/prisma';
import { resolveInteractiveStaffActor } from '../../kernel/staff-subject';

export interface AriaWorkshopAttendeeForStaff {
  readonly attendeeId: string;
  readonly studentId: string;
  readonly studentName: string;
  readonly status: 'REGISTERED' | 'ATTENDED' | 'ABSENT' | 'CANCELLED';
}

export interface AriaWorkshopSessionForStaff {
  readonly id: string;
  readonly courseKey: string;
  readonly title: string;
  readonly scheduledDate: Date;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
  readonly attendees: readonly AriaWorkshopAttendeeForStaff[];
}

export async function listAriaWorkshopsForStaff(input: {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly courseKey?: string;
}): Promise<readonly AriaWorkshopSessionForStaff[]> {
  resolveInteractiveStaffActor(input.actor);

  const sessions = await prisma.ariaWorkshopSession.findMany({
    where: input.courseKey ? { courseKey: input.courseKey } : {},
    orderBy: { scheduledDate: 'desc' },
    include: {
      attendees: {
        include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      },
    },
  });

  return Object.freeze(
    sessions.map((session) => ({
      id: session.id,
      courseKey: session.courseKey,
      title: session.title,
      scheduledDate: session.scheduledDate,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      attendees: Object.freeze(
        session.attendees.map((attendee) => ({
          attendeeId: attendee.id,
          studentId: attendee.studentId,
          studentName: `${attendee.student.user.firstName ?? ''} ${attendee.student.user.lastName ?? ''}`.trim(),
          status: attendee.status,
        })),
      ),
    })),
  );
}
