/**
 * AcademicYear lifecycle: UPCOMING -> CURRENT -> CLOSED. At most one CURRENT
 * at any time — the partial unique index academic_years_single_current_key
 * is the race-safe authority; the checks here only produce friendly errors.
 */
import { z } from 'zod';
import type { AcademicYear, PrismaClient } from '@/core-v2/generated/client';
import { appendAuditEvent } from '../audit';
import { ConflictError, InvalidStateError, NotFoundError, ValidationError, isUniqueViolation } from '../errors';
import { assertCapability } from '../rbac';
import { createAcademicYear as insertAcademicYear } from '../repositories/academic-year';
import type { ServiceContext } from './context';
import { inTransaction } from './context';
import { idSchema, parseInput } from './validation';

const createSchema = z.object({
  startYear: z.number().int().min(2000).max(2100),
  startsAt: z.date(),
  endsAt: z.date(),
});

export type CreateAcademicYearInput = z.input<typeof createSchema>;

export async function createAcademicYear(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: CreateAcademicYearInput,
): Promise<AcademicYear> {
  assertCapability(ctx.actor, 'ENROLLMENT_CREATE');
  const input = parseInput(createSchema, rawInput);
  if (input.endsAt <= input.startsAt) {
    throw new ValidationError('endsAt must be after startsAt.', { field: 'endsAt' });
  }
  if (input.startsAt.getUTCFullYear() !== input.startYear) {
    throw new ValidationError('startsAt must fall in startYear.', { field: 'startsAt' });
  }
  if (input.endsAt.getUTCFullYear() !== input.startYear + 1) {
    throw new ValidationError('endsAt must fall in the year after startYear.', { field: 'endsAt' });
  }

  return inTransaction(client, async (tx) => {
    let year: AcademicYear;
    try {
      year = await insertAcademicYear(tx, input);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(`Academic year ${input.startYear} already exists.`, { startYear: input.startYear });
      }
      throw error;
    }
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'academic_year.created',
      subjectType: 'AcademicYear',
      subjectId: year.id,
      correlationId: ctx.correlationId,
      metadata: { startYear: year.startYear },
    });
    return year;
  });
}

/** Promotes an UPCOMING year to CURRENT and closes the previously CURRENT one in the same transaction. */
export async function setCurrentAcademicYear(
  client: PrismaClient,
  ctx: ServiceContext,
  rawYearId: string,
): Promise<AcademicYear> {
  assertCapability(ctx.actor, 'ENROLLMENT_CREATE');
  const yearId = parseInput(idSchema, rawYearId);

  return inTransaction(client, async (tx) => {
    const target = await tx.academicYear.findUnique({ where: { id: yearId } });
    if (!target) throw new NotFoundError('Academic year not found.', { yearId });
    if (target.status !== 'UPCOMING') {
      throw new InvalidStateError(`Only an UPCOMING year can become CURRENT (is ${target.status}).`, {
        yearId,
        status: target.status,
      });
    }

    const previous = await tx.academicYear.findMany({ where: { status: 'CURRENT' } });
    for (const year of previous) {
      await tx.academicYear.update({ where: { id: year.id }, data: { status: 'CLOSED' } });
      await appendAuditEvent(tx, {
        actorUserId: ctx.actor.userId,
        action: 'academic_year.status_changed',
        subjectType: 'AcademicYear',
        subjectId: year.id,
        correlationId: ctx.correlationId,
        metadata: { from: 'CURRENT', to: 'CLOSED' },
      });
    }

    let promoted: AcademicYear;
    try {
      promoted = await tx.academicYear.update({ where: { id: yearId }, data: { status: 'CURRENT' } });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Another academic year became CURRENT concurrently.', { yearId });
      }
      throw error;
    }
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'academic_year.status_changed',
      subjectType: 'AcademicYear',
      subjectId: yearId,
      correlationId: ctx.correlationId,
      metadata: { from: 'UPCOMING', to: 'CURRENT' },
    });
    return promoted;
  });
}

export async function closeAcademicYear(
  client: PrismaClient,
  ctx: ServiceContext,
  rawYearId: string,
): Promise<AcademicYear> {
  assertCapability(ctx.actor, 'ENROLLMENT_CREATE');
  const yearId = parseInput(idSchema, rawYearId);

  return inTransaction(client, async (tx) => {
    const moved = await tx.academicYear.updateMany({
      where: { id: yearId, status: 'CURRENT' },
      data: { status: 'CLOSED' },
    });
    if (moved.count !== 1) {
      const current = await tx.academicYear.findUnique({ where: { id: yearId } });
      if (!current) throw new NotFoundError('Academic year not found.', { yearId });
      throw new InvalidStateError(`Only a CURRENT year can be closed (is ${current.status}).`, {
        yearId,
        status: current.status,
      });
    }
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'academic_year.status_changed',
      subjectType: 'AcademicYear',
      subjectId: yearId,
      correlationId: ctx.correlationId,
      metadata: { from: 'CURRENT', to: 'CLOSED' },
    });
    return tx.academicYear.findUniqueOrThrow({ where: { id: yearId } });
  });
}
