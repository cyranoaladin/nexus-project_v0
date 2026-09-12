/**
 * Real ARIA collective workshops visible to a real, eligible student
 * (P7d) — scoped to a real course the student is both academically
 * enrolled in and commercially entitled for at a tier that includes
 * `collectiveWorkshop` (see authorize.ts). Never lists a workshop for a
 * course the student isn't eligible for, and never shows another
 * student's own registration status.
 *
 * A real, academically-enrolled, commercially-entitled student whose
 * tier simply doesn't include collective workshops gets a real empty
 * list here, not a thrown error: this is a *browse* path, mounted
 * unconditionally by the cockpit UI for every course regardless of
 * tier, same "never a placeholder implying a capability that isn't real
 * for them, just isn't shown" principle already established for
 * courses/resources — a thrown 403 here would be the expected, common
 * case for most students (AUTONOMIE tier), which the real browser
 * itself logs as a console-level network error on every course view.
 * `registerForAriaWorkshop` (the actual mutation) keeps the strict
 * throw via `authorizeWorkshopCourseForActor` directly, unaffected: a
 * deliberate registration attempt against real ineligibility is a real
 * denial, not a browse-time non-event.
 */
import { prisma } from '@/lib/prisma';
import { AriaError } from '../../errors';
import { authorizeWorkshopCourseForActor, type AriaWorkshopActorInput } from './authorize';

const TIER_INELIGIBLE_REASON_CODE = 'ARIA_TIER_COLLECTIVE_WORKSHOP_NOT_INCLUDED';

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
  let authorized: Awaited<ReturnType<typeof authorizeWorkshopCourseForActor>>;
  try {
    authorized = await authorizeWorkshopCourseForActor(input);
  } catch (error) {
    if (error instanceof AriaError) {
      const details = error.internalDetails as { reasonCode?: string } | undefined;
      if (details?.reasonCode === TIER_INELIGIBLE_REASON_CODE) return Object.freeze([]);
    }
    throw error;
  }
  const { student, courseKey } = authorized;

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
