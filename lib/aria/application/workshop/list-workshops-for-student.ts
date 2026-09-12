/**
 * Real ARIA collective workshops visible to a real, eligible student
 * (P7d) — scoped to a real course the student is both academically
 * enrolled in and commercially entitled for at a tier that includes
 * `collectiveWorkshop` (see authorize.ts). Never lists a workshop for a
 * course the student isn't eligible for, and never shows another
 * student's own registration status.
 */
import { prisma } from '@/lib/prisma';
import { authorizeWorkshopCourseForActor, type AriaWorkshopActorInput } from './authorize';

export interface AriaWorkshopForStudent {
  readonly id: string;
  readonly title: string;
  readonly scheduledDate: Date;
  readonly startTime: string;
  readonly endTime: string;
  readonly location: string | null;
  readonly coachName: string | null;
  readonly myAttendanceStatus: 'REGISTERED' | 'ATTENDED' | 'ABSENT' | 'CANCELLED' | null;
}

export async function listAriaWorkshopsForActor(
  input: AriaWorkshopActorInput & { readonly courseKey: string },
): Promise<readonly AriaWorkshopForStudent[]> {
  const { student, courseKey } = await authorizeWorkshopCourseForActor(input);

  const sessions = await prisma.ariaWorkshopSession.findMany({
    where: { courseKey, status: 'SCHEDULED' },
    orderBy: { scheduledDate: 'asc' },
    include: {
      coachProfile: { select: { pseudonym: true } },
      attendees: { where: { studentId: student.id }, select: { status: true } },
    },
  });

  return Object.freeze(
    sessions.map((session) => ({
      id: session.id,
      title: session.title,
      scheduledDate: session.scheduledDate,
      startTime: session.startTime,
      endTime: session.endTime,
      location: session.location,
      coachName: session.coachProfile?.pseudonym ?? null,
      myAttendanceStatus: session.attendees[0]?.status ?? null,
    })),
  );
}
