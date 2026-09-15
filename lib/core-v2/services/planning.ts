/**
 * PlanningSeries = recurring planning authority, always tied to an ACTIVE
 * assignment. Local times are interpreted in the organization timezone
 * (configuration, captured on the row at creation). Changes are optimistic:
 * the caller states the revision it read; a stale revision is a CONFLICT.
 */
import { z } from 'zod';
import type { PlanningSeries, PrismaClient } from '@/core-v2/generated/client';
import { appendAuditEvent } from '../audit';
import { getOrganizationTimezone } from '../config';
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../errors';
import { assertCapability } from '../rbac';
import type { ServiceContext } from './context';
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

const createSchema = seriesFieldsSchema.extend({ assignmentId: idSchema });

export type CreatePlanningSeriesInput = z.input<typeof createSchema>;

export async function createPlanningSeries(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: CreatePlanningSeriesInput,
): Promise<PlanningSeries> {
  assertCapability(ctx.actor, 'PLANNING_MANAGE');
  const input = parseInput(createSchema, rawInput);
  assertTimeWindow(input);
  const timezone = getOrganizationTimezone();

  return inTransaction(client, async (tx) => {
    const assignment = await tx.coachStudentCourseAssignment.findUnique({ where: { id: input.assignmentId } });
    if (!assignment) throw new NotFoundError('Assignment not found.', { assignmentId: input.assignmentId });
    if (assignment.status !== 'ACTIVE') {
      throw new InvalidStateError('Planning requires an ACTIVE assignment.', {
        assignmentId: input.assignmentId,
        status: assignment.status,
      });
    }
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
    return series;
  });
}

const changeSchema = z.object({
  seriesId: idSchema,
  expectedRevision: z.number().int().min(0),
  changes: seriesFieldsSchema.partial().extend({ status: z.enum(['ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED']).optional() }),
});

export type ChangePlanningSeriesInput = z.input<typeof changeSchema>;

export async function changePlanningSeries(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: ChangePlanningSeriesInput,
): Promise<PlanningSeries> {
  assertCapability(ctx.actor, 'PLANNING_MANAGE');
  const input = parseInput(changeSchema, rawInput);
  if (Object.keys(input.changes).length === 0) throw new ValidationError('No change provided.');

  return inTransaction(client, async (tx) => {
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
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'planning.series_changed',
      subjectType: 'PlanningSeries',
      subjectId: input.seriesId,
      correlationId: ctx.correlationId,
      metadata: { fields: Object.keys(input.changes), fromRevision: input.expectedRevision },
    });
    return tx.planningSeries.findUniqueOrThrow({ where: { id: input.seriesId } });
  });
}
