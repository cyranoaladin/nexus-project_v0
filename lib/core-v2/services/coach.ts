/**
 * Coach capability (what a coach may teach) and assignment (one coach, one
 * student-year, one course). The partial unique index
 * coach_student_course_assignments_active_triple_key is the race-safe
 * authority against a duplicate ACTIVE assignment.
 */
import { z } from 'zod';
import type { CoachCourseCapability, CoachStudentCourseAssignment, PrismaClient } from '@/core-v2/generated/client';
import { appendAuditEvent } from '../audit';
import { ConflictError, InvalidStateError, NotFoundError, isUniqueViolation } from '../errors';
import { assertCapability } from '../rbac';
import type { ServiceContext } from './context';
import { inTransaction } from './context';
import { courseKeySchema, idSchema, parseInput } from './validation';

const capabilitySchema = z.object({ coachId: idSchema, courseKey: courseKeySchema, granted: z.boolean() });

export type SetCoachCapabilityInput = z.input<typeof capabilitySchema>;

/** Idempotent: granting an existing capability or revoking an absent one is a no-op (no audit row). */
export async function setCoachCapability(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: SetCoachCapabilityInput,
): Promise<CoachCourseCapability | null> {
  assertCapability(ctx.actor, 'COACH_CAPABILITY_MANAGE');
  const input = parseInput(capabilitySchema, rawInput);

  return inTransaction(client, async (tx) => {
    const coach = await tx.coachProfile.findUnique({ where: { id: input.coachId } });
    if (!coach) throw new NotFoundError('Coach not found.', { coachId: input.coachId });
    const existing = await tx.coachCourseCapability.findUnique({
      where: { coachId_courseKey: { coachId: input.coachId, courseKey: input.courseKey } },
    });

    if (input.granted) {
      if (existing) return existing;
      let created: CoachCourseCapability;
      try {
        created = await tx.coachCourseCapability.create({ data: { coachId: input.coachId, courseKey: input.courseKey } });
      } catch (error) {
        if (isUniqueViolation(error)) {
          return tx.coachCourseCapability.findUniqueOrThrow({
            where: { coachId_courseKey: { coachId: input.coachId, courseKey: input.courseKey } },
          });
        }
        throw error;
      }
      await appendAuditEvent(tx, {
        actorUserId: ctx.actor.userId,
        action: 'coach.capability_granted',
        subjectType: 'CoachProfile',
        subjectId: input.coachId,
        correlationId: ctx.correlationId,
        metadata: { courseKey: input.courseKey },
      });
      return created;
    }

    if (!existing) return null;
    const activeUse = await tx.coachStudentCourseAssignment.count({
      where: { coachId: input.coachId, courseKey: input.courseKey, status: 'ACTIVE' },
    });
    if (activeUse > 0) {
      throw new InvalidStateError('Cannot revoke a capability while ACTIVE assignments use it.', {
        coachId: input.coachId,
        courseKey: input.courseKey,
        activeAssignments: activeUse,
      });
    }
    await tx.coachCourseCapability.delete({ where: { id: existing.id } });
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'coach.capability_revoked',
      subjectType: 'CoachProfile',
      subjectId: input.coachId,
      correlationId: ctx.correlationId,
      metadata: { courseKey: input.courseKey },
    });
    return null;
  });
}

const assignSchema = z.object({ coachId: idSchema, enrollmentId: idSchema, courseKey: courseKeySchema });

export type AssignCoachInput = z.input<typeof assignSchema>;

export async function assignCoach(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: AssignCoachInput,
): Promise<CoachStudentCourseAssignment> {
  assertCapability(ctx.actor, 'COACH_ASSIGN');
  const input = parseInput(assignSchema, rawInput);

  return inTransaction(client, async (tx) => {
    const enrollment = await tx.studentAcademicYearEnrollment.findUnique({ where: { id: input.enrollmentId } });
    if (!enrollment) throw new NotFoundError('Enrollment not found.', { enrollmentId: input.enrollmentId });
    if (enrollment.status !== 'ACTIVE') {
      throw new InvalidStateError(`Coach assignment requires an ACTIVE enrollment (is ${enrollment.status}).`, {
        enrollmentId: input.enrollmentId,
        status: enrollment.status,
      });
    }
    const follows = await tx.studentCourseEnrollment.findUnique({
      where: { academicYearEnrollmentId_courseKey: { academicYearEnrollmentId: input.enrollmentId, courseKey: input.courseKey } },
    });
    if (!follows) {
      throw new InvalidStateError('The student is not enrolled in this course.', {
        enrollmentId: input.enrollmentId,
        courseKey: input.courseKey,
      });
    }
    const capability = await tx.coachCourseCapability.findUnique({
      where: { coachId_courseKey: { coachId: input.coachId, courseKey: input.courseKey } },
    });
    if (!capability) {
      const coach = await tx.coachProfile.findUnique({ where: { id: input.coachId } });
      if (!coach) throw new NotFoundError('Coach not found.', { coachId: input.coachId });
      throw new InvalidStateError('The coach has no capability for this course.', {
        coachId: input.coachId,
        courseKey: input.courseKey,
      });
    }
    let assignment: CoachStudentCourseAssignment;
    try {
      assignment = await tx.coachStudentCourseAssignment.create({
        data: {
          coachId: input.coachId,
          academicYearEnrollmentId: input.enrollmentId,
          courseKey: input.courseKey,
          assignedById: ctx.actor.userId,
          startsAt: ctx.now(),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('An ACTIVE assignment already exists for this coach, enrollment and course.', {
          coachId: input.coachId,
          enrollmentId: input.enrollmentId,
          courseKey: input.courseKey,
        });
      }
      throw error;
    }
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'coach.assigned',
      subjectType: 'CoachStudentCourseAssignment',
      subjectId: assignment.id,
      correlationId: ctx.correlationId,
      metadata: { coachId: input.coachId, enrollmentId: input.enrollmentId, courseKey: input.courseKey },
    });
    return assignment;
  });
}

export async function endCoachAssignment(
  client: PrismaClient,
  ctx: ServiceContext,
  rawAssignmentId: string,
): Promise<CoachStudentCourseAssignment> {
  assertCapability(ctx.actor, 'COACH_ASSIGN');
  const assignmentId = parseInput(idSchema, rawAssignmentId);

  return inTransaction(client, async (tx) => {
    const endedAt = ctx.now();
    const moved = await tx.coachStudentCourseAssignment.updateMany({
      where: { id: assignmentId, status: 'ACTIVE' },
      data: { status: 'ENDED', endsAt: endedAt },
    });
    if (moved.count !== 1) {
      const current = await tx.coachStudentCourseAssignment.findUnique({ where: { id: assignmentId } });
      if (!current) throw new NotFoundError('Assignment not found.', { assignmentId });
      throw new InvalidStateError('Only an ACTIVE assignment can be ended.', { assignmentId, status: current.status });
    }
    const openSeries = await tx.planningSeries.updateMany({
      where: { assignmentId, status: { in: ['ACTIVE', 'PAUSED'] } },
      data: { status: 'ENDED', revision: { increment: 1 } },
    });
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'coach.assignment_ended',
      subjectType: 'CoachStudentCourseAssignment',
      subjectId: assignmentId,
      correlationId: ctx.correlationId,
      metadata: { endedPlanningSeries: openSeries.count },
    });
    return tx.coachStudentCourseAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
  });
}
