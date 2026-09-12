/**
 * StudentAcademicYearEnrollment = THE roster authority. Status transitions
 * are compare-and-set on the expected previous status (never an arbitrary
 * write); creation is PENDING and approval is a distinct, audited act.
 */
import { z } from 'zod';
import type {
  PrismaClient,
  StudentAcademicYearEnrollment,
  StudentCourseEnrollment,
} from '@/core-v2/generated/client';
import { appendAuditEvent } from '../audit';
import { ConflictError, InvalidStateError, NotFoundError, isUniqueViolation } from '../errors';
import { assertCapability } from '../rbac';
import { transitionAnnualEnrollmentStatus } from '../repositories/student';
import type { ServiceContext, Tx } from './context';
import { inTransaction } from './context';
import { courseKeySchema, idSchema, parseInput } from './validation';

const academicMapSchema = z.object({
  gradeLevel: z.enum(['QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE', 'POSTBAC', 'AUTRE']),
  academicTrack: z.enum(['COLLEGE', 'EDS_GENERALE', 'STMG', 'STI2D', 'ST2S', 'STL', 'STD2A', 'STMG_NON_LYCEEN']).optional(),
  stmgPathway: z.enum(['RHC', 'MERCATIQUE', 'GF', 'SIG', 'INDETERMINE']).nullable().optional(),
  schoolingStatus: z.enum(['SCHOOL_ENROLLED', 'INDIVIDUAL']).nullable().optional(),
  school: z.string().trim().max(200).nullable().optional(),
});

export type AcademicMapInput = z.input<typeof academicMapSchema>;

async function requireEnrollment(tx: Tx, enrollmentId: string): Promise<StudentAcademicYearEnrollment> {
  const enrollment = await tx.studentAcademicYearEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) throw new NotFoundError('Enrollment not found.', { enrollmentId });
  return enrollment;
}

export async function createAnnualEnrollment(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: { readonly studentId: string; readonly academicYearId: string; readonly academicMap: AcademicMapInput },
): Promise<StudentAcademicYearEnrollment> {
  assertCapability(ctx.actor, 'ENROLLMENT_CREATE');
  const studentId = parseInput(idSchema, rawInput.studentId);
  const academicYearId = parseInput(idSchema, rawInput.academicYearId);
  const map = parseInput(academicMapSchema, rawInput.academicMap);

  return inTransaction(client, async (tx) => {
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundError('Student not found.', { studentId });
    const year = await tx.academicYear.findUnique({ where: { id: academicYearId } });
    if (!year) throw new NotFoundError('Academic year not found.', { academicYearId });
    if (year.status === 'CLOSED') {
      throw new InvalidStateError('Cannot enroll into a CLOSED academic year.', { academicYearId });
    }
    let enrollment: StudentAcademicYearEnrollment;
    try {
      enrollment = await tx.studentAcademicYearEnrollment.create({
        data: {
          studentId,
          academicYearId,
          gradeLevel: map.gradeLevel,
          academicTrack: map.academicTrack,
          stmgPathway: map.stmgPathway ?? undefined,
          schoolingStatus: map.schoolingStatus ?? undefined,
          school: map.school ?? undefined,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('This student already has an enrollment for this academic year.', {
          studentId,
          academicYearId,
        });
      }
      throw error;
    }
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'enrollment.created',
      subjectType: 'StudentAcademicYearEnrollment',
      subjectId: enrollment.id,
      correlationId: ctx.correlationId,
      metadata: { studentId, academicYearId, status: enrollment.status },
    });
    return enrollment;
  });
}

export async function approveEnrollment(
  client: PrismaClient,
  ctx: ServiceContext,
  rawEnrollmentId: string,
): Promise<StudentAcademicYearEnrollment> {
  assertCapability(ctx.actor, 'ENROLLMENT_APPROVE');
  const enrollmentId = parseInput(idSchema, rawEnrollmentId);

  return inTransaction(client, async (tx) => {
    const moved = await transitionAnnualEnrollmentStatus(tx, enrollmentId, ['PENDING'], 'ACTIVE', {
      approvedById: ctx.actor.userId,
      approvedAt: ctx.now(),
    });
    if (moved !== 1) {
      const current = await requireEnrollment(tx, enrollmentId);
      throw new InvalidStateError(`Only a PENDING enrollment can be approved (is ${current.status}).`, {
        enrollmentId,
        status: current.status,
      });
    }
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'enrollment.approved',
      subjectType: 'StudentAcademicYearEnrollment',
      subjectId: enrollmentId,
      correlationId: ctx.correlationId,
      metadata: { from: 'PENDING', to: 'ACTIVE' },
    });
    return tx.studentAcademicYearEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
  });
}

/** Withdraws a PENDING or ACTIVE enrollment and ends its ACTIVE coach assignments in the same transaction. */
export async function withdrawEnrollment(
  client: PrismaClient,
  ctx: ServiceContext,
  rawEnrollmentId: string,
): Promise<StudentAcademicYearEnrollment> {
  assertCapability(ctx.actor, 'ENROLLMENT_WITHDRAW');
  const enrollmentId = parseInput(idSchema, rawEnrollmentId);

  return inTransaction(client, async (tx) => {
    const before = await requireEnrollment(tx, enrollmentId);
    const moved = await transitionAnnualEnrollmentStatus(tx, enrollmentId, ['PENDING', 'ACTIVE'], 'WITHDRAWN');
    if (moved !== 1) {
      throw new InvalidStateError(`Only a PENDING or ACTIVE enrollment can be withdrawn (is ${before.status}).`, {
        enrollmentId,
        status: before.status,
      });
    }
    const endedAt = ctx.now();
    const activeAssignments = await tx.coachStudentCourseAssignment.findMany({
      where: { academicYearEnrollmentId: enrollmentId, status: 'ACTIVE' },
      select: { id: true },
    });
    for (const assignment of activeAssignments) {
      await tx.coachStudentCourseAssignment.update({
        where: { id: assignment.id },
        data: { status: 'ENDED', endsAt: endedAt },
      });
      await appendAuditEvent(tx, {
        actorUserId: ctx.actor.userId,
        action: 'coach.assignment_ended',
        subjectType: 'CoachStudentCourseAssignment',
        subjectId: assignment.id,
        correlationId: ctx.correlationId,
        metadata: { reason: 'enrollment_withdrawn', enrollmentId },
      });
    }
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'enrollment.withdrawn',
      subjectType: 'StudentAcademicYearEnrollment',
      subjectId: enrollmentId,
      correlationId: ctx.correlationId,
      metadata: { from: before.status, to: 'WITHDRAWN', endedAssignments: activeAssignments.length },
    });
    return tx.studentAcademicYearEnrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
  });
}

/** Corrects THIS year's level/track/pathway. Never used to represent a new year — that is a new enrollment. */
export async function setAcademicMap(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: { readonly enrollmentId: string; readonly academicMap: AcademicMapInput },
): Promise<StudentAcademicYearEnrollment> {
  assertCapability(ctx.actor, 'STUDENT_EDIT');
  const enrollmentId = parseInput(idSchema, rawInput.enrollmentId);
  const map = parseInput(academicMapSchema, rawInput.academicMap);

  return inTransaction(client, async (tx) => {
    const before = await requireEnrollment(tx, enrollmentId);
    if (before.status !== 'PENDING' && before.status !== 'ACTIVE') {
      throw new InvalidStateError(`Cannot change the academic map of a ${before.status} enrollment.`, {
        enrollmentId,
        status: before.status,
      });
    }
    const updated = await tx.studentAcademicYearEnrollment.update({
      where: { id: enrollmentId },
      data: {
        gradeLevel: map.gradeLevel,
        academicTrack: map.academicTrack,
        stmgPathway: map.stmgPathway,
        schoolingStatus: map.schoolingStatus,
        school: map.school,
        academicRevision: { increment: 1 },
      },
    });
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'enrollment.academic_map_changed',
      subjectType: 'StudentAcademicYearEnrollment',
      subjectId: enrollmentId,
      correlationId: ctx.correlationId,
      metadata: {
        before: { gradeLevel: before.gradeLevel, academicTrack: before.academicTrack, stmgPathway: before.stmgPathway },
        after: { gradeLevel: updated.gradeLevel, academicTrack: updated.academicTrack, stmgPathway: updated.stmgPathway },
        academicRevision: updated.academicRevision,
      },
    });
    return updated;
  });
}

const courseChoiceSchema = z.object({
  courseKey: courseKeySchema,
  kind: z.enum(['SPECIALTY', 'OPTION']),
});

export type CourseChoiceInput = z.input<typeof courseChoiceSchema>;

/**
 * Replaces the explicit course choices of an enrollment with the given set.
 * Removing a course that still has an ACTIVE coach assignment is refused —
 * end the assignment explicitly first.
 */
export async function setCourseEnrollments(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: { readonly enrollmentId: string; readonly courses: readonly CourseChoiceInput[] },
): Promise<StudentCourseEnrollment[]> {
  assertCapability(ctx.actor, 'COURSE_MANAGE');
  const enrollmentId = parseInput(idSchema, rawInput.enrollmentId);
  const courses = parseInput(z.array(courseChoiceSchema).max(30), rawInput.courses);
  const wanted = new Map(courses.map((c) => [c.courseKey, c.kind] as const));
  if (wanted.size !== courses.length) {
    throw new ConflictError('Duplicate courseKey in the requested set.', { enrollmentId });
  }

  return inTransaction(client, async (tx) => {
    const enrollment = await requireEnrollment(tx, enrollmentId);
    if (enrollment.status !== 'PENDING' && enrollment.status !== 'ACTIVE') {
      throw new InvalidStateError(`Cannot change courses of a ${enrollment.status} enrollment.`, {
        enrollmentId,
        status: enrollment.status,
      });
    }
    const existing = await tx.studentCourseEnrollment.findMany({ where: { academicYearEnrollmentId: enrollmentId } });
    const existingKeys = new Set(existing.map((e) => e.courseKey));
    const toRemove = existing.filter((e) => !wanted.has(e.courseKey) || wanted.get(e.courseKey) !== e.kind);
    const toAdd = [...wanted].filter(([key, kind]) => !existing.some((e) => e.courseKey === key && e.kind === kind));

    const blocked = await tx.coachStudentCourseAssignment.findMany({
      where: {
        academicYearEnrollmentId: enrollmentId,
        status: 'ACTIVE',
        courseKey: { in: toRemove.map((e) => e.courseKey) },
      },
      select: { courseKey: true },
    });
    if (blocked.length > 0) {
      throw new InvalidStateError('Cannot remove a course that still has an ACTIVE coach assignment.', {
        enrollmentId,
        courseKeys: blocked.map((b) => b.courseKey),
      });
    }

    if (toRemove.length > 0) {
      await tx.studentCourseEnrollment.deleteMany({ where: { id: { in: toRemove.map((e) => e.id) } } });
    }
    for (const [courseKey, kind] of toAdd) {
      await tx.studentCourseEnrollment.create({ data: { academicYearEnrollmentId: enrollmentId, courseKey, kind } });
    }
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'enrollment.courses_changed',
      subjectType: 'StudentAcademicYearEnrollment',
      subjectId: enrollmentId,
      correlationId: ctx.correlationId,
      metadata: { before: [...existingKeys].sort(), after: [...wanted.keys()].sort() },
    });
    return tx.studentCourseEnrollment.findMany({ where: { academicYearEnrollmentId: enrollmentId }, orderBy: { courseKey: 'asc' } });
  });
}
