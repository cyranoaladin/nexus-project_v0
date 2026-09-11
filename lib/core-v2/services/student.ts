/**
 * Student = persistent identity only (no grade, no specialties — those are
 * per-year facts on StudentAcademicYearEnrollment). A student is always
 * created inside a household, with its own ELEVE account (PENDING_ACTIVATION).
 */
import { z } from 'zod';
import type { PrismaClient, Student, User } from '@/core-v2/generated/client';
import { appendAuditEvent } from '../audit';
import { normalizeEmail } from '../contact';
import { ConflictError, NotFoundError, isUniqueViolation } from '../errors';
import { assertCapability } from '../rbac';
import type { ServiceContext } from './context';
import { inTransaction } from './context';
import { idSchema, parseInput, personNameSchema } from './validation';

const newStudentSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: z.string().min(1).optional(),
  birthDate: z.date().optional(),
});

export type NewStudentInput = z.input<typeof newStudentSchema>;

export async function createStudent(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: { readonly householdId: string; readonly student: NewStudentInput },
): Promise<{ student: Student; user: User }> {
  assertCapability(ctx.actor, 'STUDENT_CREATE');
  const householdId = parseInput(idSchema, rawInput.householdId);
  const input = parseInput(newStudentSchema, rawInput.student);

  return inTransaction(client, async (tx) => {
    const household = await tx.household.findUnique({ where: { id: householdId } });
    if (!household) throw new NotFoundError('Household not found.', { householdId });
    let user: User;
    try {
      user = await tx.user.create({
        data: {
          role: 'ELEVE',
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email !== undefined ? normalizeEmail(input.email) : undefined,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('An account with this email already exists.', { field: 'email' });
      }
      throw error;
    }
    const student = await tx.student.create({ data: { householdId, userId: user.id, birthDate: input.birthDate } });
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'student.created',
      subjectType: 'Student',
      subjectId: student.id,
      correlationId: ctx.correlationId,
      metadata: { householdId, userId: user.id },
    });
    return { student, user };
  });
}

const identityCorrectionSchema = z
  .object({
    firstName: personNameSchema.optional(),
    lastName: personNameSchema.optional(),
    email: z.string().min(1).nullable().optional(),
    birthDate: z.date().nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'No correction provided.' });

export type StudentIdentityCorrectionInput = z.input<typeof identityCorrectionSchema>;

export async function correctStudentIdentity(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: { readonly studentId: string; readonly changes: StudentIdentityCorrectionInput },
): Promise<{ student: Student; user: User }> {
  assertCapability(ctx.actor, 'STUDENT_EDIT');
  const studentId = parseInput(idSchema, rawInput.studentId);
  const changes = parseInput(identityCorrectionSchema, rawInput.changes);

  return inTransaction(client, async (tx) => {
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundError('Student not found.', { studentId });
    let user: User;
    try {
      user = await tx.user.update({
        where: { id: student.userId },
        data: {
          firstName: changes.firstName,
          lastName: changes.lastName,
          email: changes.email === null ? null : changes.email !== undefined ? normalizeEmail(changes.email) : undefined,
          // Login-identifier change revokes live sessions.
          ...(changes.email !== undefined ? { sessionVersion: { increment: 1 } } : {}),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('An account with this email already exists.', { field: 'email' });
      }
      throw error;
    }
    const updatedStudent =
      changes.birthDate !== undefined
        ? await tx.student.update({ where: { id: studentId }, data: { birthDate: changes.birthDate } })
        : student;
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'student.identity_corrected',
      subjectType: 'Student',
      subjectId: studentId,
      correlationId: ctx.correlationId,
      metadata: { fields: Object.keys(changes) },
    });
    return { student: updatedStudent, user };
  });
}
