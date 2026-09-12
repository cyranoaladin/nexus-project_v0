/**
 * Student read model (go-live §AI): a student sees exactly their own
 * enrollments, resolved from the actor's identity (Student.userId). No id
 * parameter exists on this path, so another student's data is unreachable
 * by construction (negative proof in __tests__/core-v2/http/self-service-api.test.ts).
 */
import type { PrismaClient } from '@/core-v2/generated/client';
import type { PublicUser } from '../http/respond';
import { assertSelfServiceRole } from '../rbac';
import type { ServiceContext } from '../services/context';
import { enrollmentsInclude, mapEnrollment, publicUserSelect } from './staff';

export async function getOwnStudent(client: PrismaClient, ctx: ServiceContext) {
  assertSelfServiceRole(ctx.actor, 'ELEVE');
  const student = await client.student.findUnique({
    where: { userId: ctx.actor.userId },
    include: {
      user: { select: publicUserSelect },
      household: { include: { parents: { include: { user: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } } } },
      academicYearEnrollments: enrollmentsInclude,
    },
  });
  if (!student) return null;
  return {
    id: student.id,
    birthDate: student.birthDate,
    user: student.user as PublicUser,
    parents: student.household.parents.map((p) => ({ ...p.user, isPrimaryContact: p.isPrimaryContact })),
    enrollments: student.academicYearEnrollments.map(mapEnrollment),
  };
}

export type OwnStudent = NonNullable<Awaited<ReturnType<typeof getOwnStudent>>>;
