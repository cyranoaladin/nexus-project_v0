/**
 * Coach read model (go-live §AJ): a coach sees their own capabilities and
 * the assignments made to THEM — each with the student's name, the academic
 * year, the enrollment status and the planning series. Resolved from the
 * actor's identity (CoachProfile.userId); no id parameter exists on this
 * path. Other coaches' assignments and any family contact data are never
 * part of this model.
 */
import type { PrismaClient } from '@/core-v2/generated/client';
import type { PublicUser } from '../http/respond';
import { assertSelfServiceRole } from '../rbac';
import type { ServiceContext } from '../services/context';
import { planningSeriesSelect, publicUserSelect } from './staff';

export async function getOwnCoach(client: PrismaClient, ctx: ServiceContext) {
  assertSelfServiceRole(ctx.actor, 'COACH');
  const coach = await client.coachProfile.findUnique({
    where: { userId: ctx.actor.userId },
    include: {
      user: { select: publicUserSelect },
      capabilities: { orderBy: { courseKey: 'asc' } },
      assignments: {
        include: {
          academicYearEnrollment: {
            select: {
              id: true,
              status: true,
              gradeLevel: true,
              academicTrack: true,
              academicYear: { select: { id: true, startYear: true, status: true } },
              student: { select: { id: true, user: { select: { id: true, firstName: true, lastName: true } } } },
            },
          },
          planningSeries: { select: planningSeriesSelect },
        },
        orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
      },
    },
  });
  if (!coach) return null;
  return {
    id: coach.id,
    user: coach.user as PublicUser,
    capabilities: coach.capabilities.map((c) => c.courseKey),
    assignments: coach.assignments.map((a) => ({
      id: a.id,
      courseKey: a.courseKey,
      status: a.status,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      enrollment: {
        id: a.academicYearEnrollment.id,
        status: a.academicYearEnrollment.status,
        gradeLevel: a.academicYearEnrollment.gradeLevel,
        academicTrack: a.academicYearEnrollment.academicTrack,
        academicYear: a.academicYearEnrollment.academicYear,
      },
      student: a.academicYearEnrollment.student,
      planningSeries: a.planningSeries,
    })),
  };
}

export type OwnCoach = NonNullable<Awaited<ReturnType<typeof getOwnCoach>>>;
