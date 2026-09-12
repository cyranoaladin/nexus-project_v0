/**
 * Planning engine (go-live §AK). PlanningSeries is the recurring authority,
 * always tied to an ACTIVE assignment; every occurrence is a SessionBooking
 * row materialized at creation (and re-materialized after a time/rule
 * change), so "what happens when" is a table, not a computation repeated by
 * every reader. Local times are interpreted in the series' own IANA zone
 * (organization configuration captured on the row) — DST comes from the zone
 * database, never from a fixed offset.
 *
 * Double booking is refused twice: a deterministic pre-check inside the
 * transaction (so the caller learns WHICH occurrence collides) and the
 * database exclusion constraints of migration 0007 (so two writers racing
 * past the pre-check cannot both commit). Changes to a series are
 * optimistic: the caller states the revision it read; a stale one is a
 * CONFLICT.
 */
import { z } from 'zod';
import type { PlanningSeries, PrismaClient, SessionBooking } from '@/core-v2/generated/client';
import { appendAuditEvent } from '../audit';
import { getOrganizationTimezone } from '../config';
import { ConflictError, InvalidStateError, NotFoundError, ValidationError, isExclusionViolation } from '../errors';
import { assertCapability } from '../rbac';
import { expandRecurrence, parseRecurrenceRule } from '../recurrence';
import {
  compareLocalDates,
  formatLocalDate,
  localDateFromDateColumn,
  localDateKeyOf,
  parseLocalTime,
  zonedLocalToUtc,
  zonedParts,
  type LocalDate,
} from '../time';
import type { ServiceContext, Tx } from './context';
import { inTransaction } from './context';
import { idSchema, parseInput } from './validation';

const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM expected');
// RFC 5545 RRULE subset actually used by the planning editor; anything else is refused rather than half-interpreted.
const recurrenceRuleSchema = z
  .string()
  .regex(/^FREQ=(DAILY|WEEKLY)(;(INTERVAL=[1-9]\d?|BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*))*$/, 'unsupported RRULE');

const seriesFieldsSchema = z.object({
  startDate: z.date(),
  localStartTime: localTimeSchema,
  localEndTime: localTimeSchema,
  recurrenceRule: recurrenceRuleSchema,
  recurrenceCount: z.number().int().min(1).max(200).nullable().optional(),
  recurrenceUntil: z.date().nullable().optional(),
  modality: z.enum(['ONLINE', 'IN_PERSON', 'HYBRID']),
  location: z.string().trim().max(200).nullable().optional(),
});

function assertTimeWindow(fields: { localStartTime: string; localEndTime: string }): void {
  if (fields.localEndTime <= fields.localStartTime) {
    throw new ValidationError('localEndTime must be after localStartTime.', { field: 'localEndTime' });
  }
}

/** Statuses that occupy a slot — must match the WHERE clause of the exclusion constraints. */
export const LIVE_BOOKING_STATUSES = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] as const;

export interface Occurrence {
  readonly localDate: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

/**
 * Pure: the instants of a series' occurrences from `from` (inclusive) within
 * its bounds and the academic-year horizon. Exposed for tests and previews.
 */
export function occurrencesOf(
  series: Pick<PlanningSeries, 'timezone' | 'startDate' | 'localStartTime' | 'localEndTime' | 'recurrenceRule' | 'recurrenceCount' | 'recurrenceUntil'>,
  horizon: LocalDate,
  from?: LocalDate,
): Occurrence[] {
  const rule = parseRecurrenceRule(series.recurrenceRule);
  const start = localDateFromDateColumn(series.startDate);
  const dates = expandRecurrence(rule, start, {
    count: series.recurrenceCount,
    until: series.recurrenceUntil ? localDateFromDateColumn(series.recurrenceUntil) : null,
    horizon,
  });
  const startTime = parseLocalTime(series.localStartTime);
  const endTime = parseLocalTime(series.localEndTime);
  return dates
    .filter((d) => !from || compareLocalDates(d, from) >= 0)
    .map((d) => ({
      localDate: formatLocalDate(d),
      startsAt: zonedLocalToUtc(d, startTime, series.timezone),
      endsAt: zonedLocalToUtc(d, endTime, series.timezone),
    }));
}

/**
 * Unique per (series, revision, local date): a re-materialization after a
 * schedule change writes new keys while the superseded rows keep theirs as
 * history, so the unique index never collides and the trail stays readable.
 */
export function occurrenceKey(seriesId: string, revision: number, localDate: string): string {
  return `${seriesId}:r${revision}:${localDate}`;
}

export interface Participants {
  readonly coachId: string;
  readonly studentId: string;
  readonly horizon: LocalDate;
}

async function loadActiveAssignment(tx: Tx, assignmentId: string): Promise<Participants & { id: string }> {
  const assignment = await tx.coachStudentCourseAssignment.findUnique({
    where: { id: assignmentId },
    include: { academicYearEnrollment: { select: { studentId: true, academicYear: { select: { endsAt: true } } } } },
  });
  if (!assignment) throw new NotFoundError('Assignment not found.', { assignmentId });
  if (assignment.status !== 'ACTIVE') {
    throw new InvalidStateError('Planning requires an ACTIVE assignment.', { assignmentId, status: assignment.status });
  }
  return {
    id: assignment.id,
    coachId: assignment.coachId,
    studentId: assignment.academicYearEnrollment.studentId,
    // The academic year's end is the horizon no open-ended rule may cross (configuration, not a constant).
    horizon: localDateFromDateColumn(assignment.academicYearEnrollment.academicYear.endsAt),
  };
}

export interface SlotConflict {
  readonly localDate: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly with: 'COACH' | 'STUDENT';
  readonly bookingId: string;
}

/** Deterministic pre-check: every live booking of the coach or the student overlapping any occurrence. */
async function findConflicts(
  tx: Tx,
  participants: Pick<Participants, 'coachId' | 'studentId'>,
  occurrences: readonly Occurrence[],
  ignoreBookingIds: readonly string[] = [],
): Promise<SlotConflict[]> {
  if (occurrences.length === 0) return [];
  const windowStart = new Date(Math.min(...occurrences.map((o) => o.startsAt.getTime())));
  const windowEnd = new Date(Math.max(...occurrences.map((o) => o.endsAt.getTime())));
  const live = await tx.sessionBooking.findMany({
    where: {
      status: { in: [...LIVE_BOOKING_STATUSES] },
      startsAt: { lt: windowEnd },
      endsAt: { gt: windowStart },
      OR: [{ coachId: participants.coachId }, { studentId: participants.studentId }],
      ...(ignoreBookingIds.length > 0 ? { id: { notIn: [...ignoreBookingIds] } } : {}),
    },
    select: { id: true, coachId: true, studentId: true, startsAt: true, endsAt: true },
  });
  const conflicts: SlotConflict[] = [];
  for (const occurrence of occurrences) {
    for (const booking of live) {
      if (booking.startsAt < occurrence.endsAt && booking.endsAt > occurrence.startsAt) {
        conflicts.push({
          localDate: occurrence.localDate,
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
          with: booking.coachId === participants.coachId ? 'COACH' : 'STUDENT',
          bookingId: booking.id,
        });
      }
    }
  }
  return conflicts;
}

function conflictError(conflicts: readonly SlotConflict[]): ConflictError {
  return new ConflictError('One or more occurrences collide with an existing booking.', {
    conflicts: conflicts.slice(0, 20).map((c) => ({ ...c, startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString() })),
    conflictCount: conflicts.length,
  });
}

/** Runs `work`; an exclusion-constraint race is reported as the same CONFLICT the pre-check would have given. */
async function guardingExclusion<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new ConflictError('A booking on the same slot was committed concurrently; reload and retry.', { race: true });
    }
    throw error;
  }
}

/** Participants + horizon of an ACTIVE assignment — exported for the migrator, which writes series rows with preset ids. */
export async function loadPlanningParticipants(tx: Tx, assignmentId: string): Promise<{ coachId: string; studentId: string; horizon: LocalDate }> {
  const { coachId, studentId, horizon } = await loadActiveAssignment(tx, assignmentId);
  return { coachId, studentId, horizon };
}

/**
 * Writes every occurrence of `series` from `from` (inclusive) as bookings,
 * after the deterministic conflict pre-check. Exported for the migrator;
 * the services above call it inside their own transactions.
 */
export async function materializeSeriesOccurrences(
  tx: Tx,
  ctx: ServiceContext,
  series: PlanningSeries,
  participants: Participants,
  from?: LocalDate,
): Promise<number> {
  return materialize(tx, ctx, series, participants, from);
}

async function materialize(
  tx: Tx,
  ctx: ServiceContext,
  series: PlanningSeries,
  participants: Participants,
  from?: LocalDate,
): Promise<number> {
  const occurrences = occurrencesOf(series, participants.horizon, from);
  const conflicts = await findConflicts(tx, participants, occurrences);
  if (conflicts.length > 0) throw conflictError(conflicts);
  if (occurrences.length > 0) {
    await tx.sessionBooking.createMany({
      data: occurrences.map((o) => ({
        assignmentId: series.assignmentId,
        coachId: participants.coachId,
        studentId: participants.studentId,
        planningSeriesId: series.id,
        occurrenceKey: occurrenceKey(series.id, series.revision, o.localDate),
        startsAt: o.startsAt,
        endsAt: o.endsAt,
        modality: series.modality,
        location: series.location ?? undefined,
      })),
    });
  }
  await appendAuditEvent(tx, {
    actorUserId: ctx.actor.userId,
    action: 'planning.occurrences_materialized',
    subjectType: 'PlanningSeries',
    subjectId: series.id,
    correlationId: ctx.correlationId,
    metadata: { count: occurrences.length, from: from ? formatLocalDate(from) : null, horizon: formatLocalDate(participants.horizon) },
  });
  return occurrences.length;
}

const createSchema = seriesFieldsSchema.extend({ assignmentId: idSchema });

export type CreatePlanningSeriesInput = z.input<typeof createSchema>;

export async function createPlanningSeries(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: CreatePlanningSeriesInput,
): Promise<PlanningSeries & { occurrenceCount: number }> {
  assertCapability(ctx.actor, 'PLANNING_MANAGE');
  const input = parseInput(createSchema, rawInput);
  assertTimeWindow(input);
  const timezone = getOrganizationTimezone();

  return guardingExclusion(() =>
    inTransaction(client, async (tx) => {
      const participants = await loadActiveAssignment(tx, input.assignmentId);
      const series = await tx.planningSeries.create({
        data: {
          assignmentId: input.assignmentId,
          timezone,
          startDate: input.startDate,
          localStartTime: input.localStartTime,
          localEndTime: input.localEndTime,
          recurrenceRule: input.recurrenceRule,
          recurrenceCount: input.recurrenceCount ?? undefined,
          recurrenceUntil: input.recurrenceUntil ?? undefined,
          modality: input.modality,
          location: input.location ?? undefined,
          createdById: ctx.actor.userId,
        },
      });
      await appendAuditEvent(tx, {
        actorUserId: ctx.actor.userId,
        action: 'planning.series_created',
        subjectType: 'PlanningSeries',
        subjectId: series.id,
        correlationId: ctx.correlationId,
        metadata: { assignmentId: input.assignmentId, timezone, recurrenceRule: input.recurrenceRule },
      });
      const occurrenceCount = await materialize(tx, ctx, series, participants);
      if (occurrenceCount === 0) {
        throw new ValidationError('The rule produces no occurrence before the end of the academic year.', {
          startDate: formatLocalDate(localDateFromDateColumn(input.startDate)),
          horizon: formatLocalDate(participants.horizon),
        });
      }
      return { ...series, occurrenceCount };
    }),
  );
}

const changeSchema = z.object({
  seriesId: idSchema,
  expectedRevision: z.number().int().min(0),
  changes: seriesFieldsSchema.partial().extend({ status: z.enum(['ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED']).optional() }),
});

export type ChangePlanningSeriesInput = z.input<typeof changeSchema>;

const SCHEDULE_FIELDS = ['startDate', 'localStartTime', 'localEndTime', 'recurrenceRule', 'recurrenceCount', 'recurrenceUntil'] as const;

/** "Today" in the series' zone: the first local date whose occurrences a change may still touch. */
function todayIn(timezone: string, now: Date): LocalDate {
  const p = zonedParts(now, timezone);
  return { year: p.year, month: p.month, day: p.day };
}

async function cancelFutureOccurrences(tx: Tx, seriesId: string, from: Date): Promise<number> {
  const result = await tx.sessionBooking.updateMany({
    where: { planningSeriesId: seriesId, status: { in: [...LIVE_BOOKING_STATUSES] }, startsAt: { gte: from } },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
  return result.count;
}

/**
 * Optimistic change. A schedule change (date/time/rule) is FUTURE-ONLY: past
 * and in-progress occurrences are history; live occurrences from today on
 * are cancelled and re-materialized from the new definition. Setting status
 * to ENDED/CANCELLED/PAUSED cancels every future live occurrence; back to
 * ACTIVE re-materializes from today.
 */
export async function changePlanningSeries(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: ChangePlanningSeriesInput,
): Promise<PlanningSeries> {
  assertCapability(ctx.actor, 'PLANNING_MANAGE');
  const input = parseInput(changeSchema, rawInput);
  if (Object.keys(input.changes).length === 0) throw new ValidationError('No change provided.');

  return guardingExclusion(() =>
    inTransaction(client, async (tx) => {
      const before = await tx.planningSeries.findUnique({ where: { id: input.seriesId } });
      if (!before) throw new NotFoundError('Planning series not found.', { seriesId: input.seriesId });
      if (before.status === 'ENDED' || before.status === 'CANCELLED') {
        throw new InvalidStateError(`A ${before.status} series cannot be changed.`, { seriesId: input.seriesId });
      }
      assertTimeWindow({
        localStartTime: input.changes.localStartTime ?? before.localStartTime,
        localEndTime: input.changes.localEndTime ?? before.localEndTime,
      });
      const moved = await tx.planningSeries.updateMany({
        where: { id: input.seriesId, revision: input.expectedRevision },
        data: { ...input.changes, revision: { increment: 1 } },
      });
      if (moved.count !== 1) {
        throw new ConflictError('The planning series was modified by someone else; reload and retry.', {
          seriesId: input.seriesId,
          expectedRevision: input.expectedRevision,
          currentRevision: before.revision,
        });
      }
      const after = await tx.planningSeries.findUniqueOrThrow({ where: { id: input.seriesId } });
      await appendAuditEvent(tx, {
        actorUserId: ctx.actor.userId,
        action: 'planning.series_changed',
        subjectType: 'PlanningSeries',
        subjectId: input.seriesId,
        correlationId: ctx.correlationId,
        metadata: { fields: Object.keys(input.changes), fromRevision: input.expectedRevision },
      });

      const scheduleChanged = SCHEDULE_FIELDS.some((f) => f in input.changes);
      const statusChanged = input.changes.status !== undefined && input.changes.status !== before.status;
      if (scheduleChanged || statusChanged) {
        const now = ctx.now();
        const today = todayIn(after.timezone, now);
        const cancelled = await cancelFutureOccurrences(tx, after.id, now);
        if (after.status === 'ACTIVE') {
          const participants = await loadActiveAssignment(tx, after.assignmentId);
          await materialize(tx, ctx, after, participants, today);
        } else {
          await appendAuditEvent(tx, {
            actorUserId: ctx.actor.userId,
            action: 'planning.series_cancelled',
            subjectType: 'PlanningSeries',
            subjectId: after.id,
            correlationId: ctx.correlationId,
            metadata: { status: after.status, cancelledOccurrences: cancelled },
          });
        }
      }
      return after;
    }),
  );
}

const cancelSeriesSchema = z.object({ seriesId: idSchema, expectedRevision: z.number().int().min(0) });

/** Future-only cancellation of a whole series (its past stays as history). */
export async function cancelPlanningSeries(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: z.input<typeof cancelSeriesSchema>,
): Promise<PlanningSeries> {
  const input = parseInput(cancelSeriesSchema, rawInput);
  return changePlanningSeries(client, ctx, { seriesId: input.seriesId, expectedRevision: input.expectedRevision, changes: { status: 'CANCELLED' } });
}

const cancelOccurrenceSchema = z.object({ bookingId: idSchema, reason: z.string().trim().min(1).max(200) });

export type CancelOccurrenceInput = z.input<typeof cancelOccurrenceSchema>;

/** An exception: this one occurrence will not happen; the series continues. */
export async function cancelOccurrence(client: PrismaClient, ctx: ServiceContext, rawInput: CancelOccurrenceInput): Promise<SessionBooking> {
  assertCapability(ctx.actor, 'PLANNING_MANAGE');
  const input = parseInput(cancelOccurrenceSchema, rawInput);
  return inTransaction(client, async (tx) => {
    const booking = await tx.sessionBooking.findUnique({ where: { id: input.bookingId } });
    if (!booking) throw new NotFoundError('Booking not found.', { bookingId: input.bookingId });
    if (!(LIVE_BOOKING_STATUSES as readonly string[]).includes(booking.status)) {
      throw new InvalidStateError(`A ${booking.status} booking cannot be cancelled.`, { bookingId: booking.id, status: booking.status });
    }
    const updated = await tx.sessionBooking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED', cancelledAt: ctx.now() },
    });
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'planning.occurrence_cancelled',
      subjectType: 'SessionBooking',
      subjectId: booking.id,
      correlationId: ctx.correlationId,
      metadata: { planningSeriesId: booking.planningSeriesId, startsAt: booking.startsAt.toISOString(), reason: input.reason },
    });
    return updated;
  });
}

const rescheduleSchema = z.object({
  bookingId: idSchema,
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  localStartTime: localTimeSchema,
  localEndTime: localTimeSchema,
  reason: z.string().trim().min(1).max(200),
});

export type RescheduleOccurrenceInput = z.input<typeof rescheduleSchema>;

/**
 * An exception that moves ONE occurrence: the original row becomes
 * RESCHEDULED (it no longer occupies its slot) and a new booking, linked
 * through overridesBookingId, takes the new slot — in the series' zone.
 * Re-materialization after a later series change leaves the pair alone:
 * the override has no occurrenceKey and the original is no longer live.
 */
export async function rescheduleOccurrence(client: PrismaClient, ctx: ServiceContext, rawInput: RescheduleOccurrenceInput): Promise<SessionBooking> {
  assertCapability(ctx.actor, 'PLANNING_MANAGE');
  const input = parseInput(rescheduleSchema, rawInput);
  assertTimeWindow(input);

  return guardingExclusion(() =>
    inTransaction(client, async (tx) => {
      const booking = await tx.sessionBooking.findUnique({ where: { id: input.bookingId }, include: { planningSeries: { select: { timezone: true } } } });
      if (!booking) throw new NotFoundError('Booking not found.', { bookingId: input.bookingId });
      if (!(LIVE_BOOKING_STATUSES as readonly string[]).includes(booking.status)) {
        throw new InvalidStateError(`A ${booking.status} booking cannot be rescheduled.`, { bookingId: booking.id, status: booking.status });
      }
      const timezone = booking.planningSeries?.timezone ?? getOrganizationTimezone();
      const [y, m, d] = input.localDate.split('-').map(Number) as [number, number, number];
      const localDate: LocalDate = { year: y, month: m, day: d };
      const occurrence: Occurrence = {
        localDate: input.localDate,
        startsAt: zonedLocalToUtc(localDate, parseLocalTime(input.localStartTime), timezone),
        endsAt: zonedLocalToUtc(localDate, parseLocalTime(input.localEndTime), timezone),
      };
      if (localDateKeyOf(occurrence.startsAt, timezone) !== input.localDate) {
        throw new ValidationError('Invalid local date.', { localDate: input.localDate });
      }
      const conflicts = await findConflicts(tx, { coachId: booking.coachId, studentId: booking.studentId }, [occurrence], [booking.id]);
      if (conflicts.length > 0) throw conflictError(conflicts);

      await tx.sessionBooking.update({ where: { id: booking.id }, data: { status: 'RESCHEDULED' } });
      const replacement = await tx.sessionBooking.create({
        data: {
          assignmentId: booking.assignmentId,
          coachId: booking.coachId,
          studentId: booking.studentId,
          planningSeriesId: booking.planningSeriesId,
          overridesBookingId: booking.id,
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
          modality: booking.modality,
          location: booking.location,
        },
      });
      await appendAuditEvent(tx, {
        actorUserId: ctx.actor.userId,
        action: 'planning.occurrence_rescheduled',
        subjectType: 'SessionBooking',
        subjectId: booking.id,
        correlationId: ctx.correlationId,
        metadata: {
          replacementBookingId: replacement.id,
          from: booking.startsAt.toISOString(),
          to: occurrence.startsAt.toISOString(),
          reason: input.reason,
        },
      });
      return replacement;
    }),
  );
}
