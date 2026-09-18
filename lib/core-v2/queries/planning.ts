/**
 * Planning read models (§AK). Staff read any range (HOUSEHOLD_READ); a coach,
 * a student or a parent reads only the bookings of their own profile /
 * household, resolved from the actor — no id parameter exists on those
 * paths. Every row carries who/what/when and never a password or a contact
 * detail of the other party.
 */
import { z } from 'zod';
import type { PrismaClient, Prisma } from '@/core-v2/generated/client';
import { assertCapability, assertSelfServiceRole } from '../rbac';
import type { ServiceContext } from '../services/context';
import { idSchema } from '../services/validation';

export const planningRangeSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    coachId: idSchema.optional(),
    studentId: idSchema.optional(),
    status: z.enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED']).optional(),
  })
  .refine((v) => v.to > v.from, { message: '`to` must be after `from`.' })
  .refine((v) => v.to.getTime() - v.from.getTime() <= 120 * 86_400_000, { message: 'Range must not exceed 120 days.' });

export type PlanningRange = z.infer<typeof planningRangeSchema>;

export const selfRangeSchema = z
  .object({ from: z.coerce.date(), to: z.coerce.date() })
  .refine((v) => v.to > v.from, { message: '`to` must be after `from`.' })
  .refine((v) => v.to.getTime() - v.from.getTime() <= 120 * 86_400_000, { message: 'Range must not exceed 120 days.' });

const bookingInclude = {
  coach: { select: { id: true, user: { select: { id: true, firstName: true, lastName: true } } } },
  student: { select: { id: true, user: { select: { id: true, firstName: true, lastName: true } } } },
  assignment: { select: { id: true, courseKey: true, status: true } },
  planningSeries: { select: { id: true, timezone: true, recurrenceRule: true, revision: true, status: true } },
} satisfies Prisma.SessionBookingInclude;

type BookingRow = Prisma.SessionBookingGetPayload<{ include: typeof bookingInclude }>;

export function mapBooking(b: BookingRow) {
  return {
    id: b.id,
    status: b.status,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    modality: b.modality,
    location: b.location,
    occurrenceKey: b.occurrenceKey,
    overridesBookingId: b.overridesBookingId,
    cancelledAt: b.cancelledAt,
    completedAt: b.completedAt,
    courseKey: b.assignment.courseKey,
    assignment: b.assignment,
    coach: b.coach,
    student: b.student,
    series: b.planningSeries,
  };
}

export type BookingView = ReturnType<typeof mapBooking>;

async function loadRange(client: PrismaClient, where: Prisma.SessionBookingWhereInput, range: { from: Date; to: Date }): Promise<BookingView[]> {
  const rows = await client.sessionBooking.findMany({
    where: { ...where, startsAt: { lt: range.to }, endsAt: { gt: range.from } },
    include: bookingInclude,
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    take: 2000,
  });
  return rows.map(mapBooking);
}

export async function listBookings(client: PrismaClient, ctx: ServiceContext, range: PlanningRange): Promise<BookingView[]> {
  assertCapability(ctx.actor, 'HOUSEHOLD_READ');
  return loadRange(
    client,
    {
      ...(range.coachId ? { coachId: range.coachId } : {}),
      ...(range.studentId ? { studentId: range.studentId } : {}),
      ...(range.status ? { status: range.status } : {}),
    },
    range,
  );
}

export async function listOwnCoachBookings(client: PrismaClient, ctx: ServiceContext, range: { from: Date; to: Date }): Promise<BookingView[]> {
  assertSelfServiceRole(ctx.actor, 'COACH');
  const coach = await client.coachProfile.findUnique({ where: { userId: ctx.actor.userId }, select: { id: true } });
  if (!coach) return [];
  return loadRange(client, { coachId: coach.id }, range);
}

export async function listOwnStudentBookings(client: PrismaClient, ctx: ServiceContext, range: { from: Date; to: Date }): Promise<BookingView[]> {
  assertSelfServiceRole(ctx.actor, 'ELEVE');
  const student = await client.student.findUnique({ where: { userId: ctx.actor.userId }, select: { id: true } });
  if (!student) return [];
  return loadRange(client, { studentId: student.id }, range);
}

export async function listOwnHouseholdBookings(client: PrismaClient, ctx: ServiceContext, range: { from: Date; to: Date }): Promise<BookingView[]> {
  assertSelfServiceRole(ctx.actor, 'PARENT');
  const membership = await client.householdParent.findUnique({ where: { userId: ctx.actor.userId }, select: { householdId: true } });
  if (!membership) return [];
  return loadRange(client, { student: { householdId: membership.householdId } }, range);
}
