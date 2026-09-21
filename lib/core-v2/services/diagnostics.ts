/**
 * Diagnostics candidats libres — C1 (attribution, subject access, deposit).
 *
 * Identity/dossier authority is Core v2 (this file); instrument/barème
 * authority is the private catalog, mirrored read-only into
 * DiagnosticInstrumentRef (never written here — see
 * scripts/core-v2/ingest-diagnostic-catalog.ts / seed-diagnostic-catalog-demo.ts).
 * An attribution freezes the instrument's meaning at selection time
 * (*Snapshot fields) so a later catalog change never silently mutates work
 * already handed to a candidate.
 */
import { z } from 'zod';
import type {
  DiagnosticAssignment,
  DiagnosticInstrumentRef,
  DiagnosticSubmission,
  PrismaClient,
} from '@/core-v2/generated/client';
import { appendAuditEvent } from '../audit';
import { assertAttributable } from '../diagnostics/catalog';
import { assertDemoFixtureAttributable } from '../diagnostics/demo-scope';
import { ConflictError, ForbiddenError, InvalidStateError, NotFoundError, isUniqueViolation } from '../errors';
import { assertCapability, assertSelfServiceRole } from '../rbac';
import type { ServiceContext, Tx } from './context';
import { inTransaction } from './context';
import { idSchema, parseInput } from './validation';

const attributeSchema = z.object({
  studentId: idSchema,
  instrumentRefId: idSchema,
  dueAt: z.date().optional(),
  modalities: z.string().trim().min(1).max(500).optional(),
  reviewerId: idSchema.optional(),
});
export type AttributeDiagnosticInput = z.input<typeof attributeSchema>;

/** Staff-facing catalog listing — every row, every status (the operator must see WHY something isn't selectable). */
export async function listDiagnosticInstruments(
  client: PrismaClient,
  ctx: ServiceContext,
): Promise<DiagnosticInstrumentRef[]> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_CATALOG_READ');
  return client.diagnosticInstrumentRef.findMany({ orderBy: [{ subject: 'asc' }, { title: 'asc' }] });
}

async function buildStudentProfileSnapshot(tx: Tx, studentId: string) {
  const activeEnrollment = await tx.studentAcademicYearEnrollment.findFirst({
    where: { studentId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: { academicYear: true, courseEnrollments: { select: { courseKey: true, kind: true } } },
  });
  if (!activeEnrollment) {
    return { available: false as const };
  }
  return {
    available: true as const,
    academicYearStartYear: activeEnrollment.academicYear.startYear,
    gradeLevel: activeEnrollment.gradeLevel,
    academicTrack: activeEnrollment.academicTrack,
    courses: activeEnrollment.courseEnrollments.map((c: { courseKey: string; kind: string }) => ({ courseKey: c.courseKey, kind: c.kind })),
  };
}

export async function attributeDiagnostic(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: AttributeDiagnosticInput,
): Promise<DiagnosticAssignment> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_ASSIGN');
  const input = parseInput(attributeSchema, rawInput);

  return inTransaction(client, async (tx) => {
    const student = await tx.student.findUnique({ where: { id: input.studentId } });
    if (!student) throw new NotFoundError('Student not found.', { studentId: input.studentId });

    const instrument = await tx.diagnosticInstrumentRef.findUnique({ where: { id: input.instrumentRefId } });
    if (!instrument) throw new NotFoundError('Instrument not found.', { instrumentRefId: input.instrumentRefId });
    assertAttributable(instrument);
    if (instrument.catalogStatus === 'DEMO_FIXTURE') {
      assertDemoFixtureAttributable(student.id);
    }

    if (input.reviewerId) {
      const reviewer = await tx.user.findUnique({ where: { id: input.reviewerId } });
      if (!reviewer) throw new NotFoundError('Reviewer not found.', { reviewerId: input.reviewerId });
    }

    const studentProfileSnapshot = await buildStudentProfileSnapshot(tx, student.id);

    let assignment: DiagnosticAssignment;
    try {
      assignment = await tx.diagnosticAssignment.create({
        data: {
          studentId: student.id,
          instrumentRefId: instrument.id,
          instrumentKeySnapshot: instrument.instrumentKey,
          instrumentVersionSnapshot: instrument.version,
          formSnapshot: instrument.form,
          manifestChecksumSnapshot: instrument.manifestChecksum,
          conditionsSnapshot: instrument.attributionConditions,
          studentProfileSnapshot,
          dueAt: input.dueAt,
          modalities: input.modalities,
          reviewerId: input.reviewerId,
          assignedById: ctx.actor.userId,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('This student already has a non-revoked attribution for this instrument.', {
          studentId: input.studentId,
          instrumentRefId: input.instrumentRefId,
        });
      }
      throw error;
    }

    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'diagnostic.assigned',
      subjectType: 'DiagnosticAssignment',
      subjectId: assignment.id,
      correlationId: ctx.correlationId,
      metadata: { studentId: student.id, instrumentRefId: instrument.id, instrumentKey: instrument.instrumentKey },
    });

    return assignment;
  });
}

const revokeSchema = z.object({ assignmentId: idSchema, reason: z.string().trim().min(1).max(500) });
export type RevokeDiagnosticAssignmentInput = z.input<typeof revokeSchema>;

/** Security-suspension policy: flips status to REVOKED, keeps full history (never deletes the row). */
export async function revokeDiagnosticAssignment(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: RevokeDiagnosticAssignmentInput,
): Promise<DiagnosticAssignment> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_ASSIGN');
  const input = parseInput(revokeSchema, rawInput);

  return inTransaction(client, async (tx) => {
    const existing = await tx.diagnosticAssignment.findUnique({ where: { id: input.assignmentId } });
    if (!existing) throw new NotFoundError('Assignment not found.', { assignmentId: input.assignmentId });
    if (existing.status === 'REVOKED') {
      throw new InvalidStateError('Assignment is already revoked.', { assignmentId: input.assignmentId });
    }

    const assignment = await tx.diagnosticAssignment.update({
      where: { id: input.assignmentId },
      data: { status: 'REVOKED' },
    });

    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'diagnostic.revoked',
      subjectType: 'DiagnosticAssignment',
      subjectId: assignment.id,
      correlationId: ctx.correlationId,
      metadata: { reason: input.reason, previousStatus: existing.status },
    });

    return assignment;
  });
}

export interface DiagnosticAssignmentWithSubmissions extends DiagnosticAssignment {
  instrumentRef: DiagnosticInstrumentRef;
  submissions: DiagnosticSubmission[];
}

/** Staff dossier view: every assignment for one student, with its full submission history. */
export async function listDiagnosticAssignmentsForStudent(
  client: PrismaClient,
  ctx: ServiceContext,
  studentId: string,
): Promise<DiagnosticAssignmentWithSubmissions[]> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_CATALOG_READ');
  const id = parseInput(idSchema, studentId);
  return client.diagnosticAssignment.findMany({
    where: { studentId: id },
    include: { instrumentRef: true, submissions: { orderBy: { version: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function loadOwnStudentOrThrow(client: PrismaClient, ctx: ServiceContext) {
  assertSelfServiceRole(ctx.actor, 'ELEVE');
  const student = await client.student.findUnique({ where: { userId: ctx.actor.userId } });
  if (!student) throw new NotFoundError('No student record for this account.', { userId: ctx.actor.userId });
  return student;
}

/** Self-service: the authenticated candidate's own assignments — no id parameter is ever accepted on this path. */
export async function getOwnDiagnosticAssignments(
  client: PrismaClient,
  ctx: ServiceContext,
): Promise<DiagnosticAssignmentWithSubmissions[]> {
  const student = await loadOwnStudentOrThrow(client, ctx);
  return client.diagnosticAssignment.findMany({
    where: { studentId: student.id },
    include: { instrumentRef: true, submissions: { orderBy: { version: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Self-service: resolves ONE of the candidate's own assignments for subject
 * access. Throws NotFoundError (never ForbiddenError) if the assignment
 * belongs to someone else — indistinguishable from "does not exist" so a
 * candidate probing ids learns nothing about other candidates' attributions.
 */
export async function getOwnDiagnosticAssignmentForSubjectAccess(
  client: PrismaClient,
  ctx: ServiceContext,
  assignmentId: string,
): Promise<DiagnosticAssignmentWithSubmissions> {
  const student = await loadOwnStudentOrThrow(client, ctx);
  const id = parseInput(idSchema, assignmentId);
  const assignment = await client.diagnosticAssignment.findFirst({
    where: { id, studentId: student.id },
    include: { instrumentRef: true, submissions: { orderBy: { version: 'asc' } } },
  });
  if (!assignment) throw new NotFoundError('Assignment not found.', { assignmentId: id });
  if (assignment.status === 'REVOKED') {
    throw new ForbiddenError('This attribution has been revoked.', { assignmentId: id });
  }
  return assignment;
}

const createSubmissionSchema = z.object({
  assignmentId: idSchema,
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().trim().regex(/^[a-f0-9]{64}$/i),
  storageKey: z.string().trim().min(1).max(500),
  // Set only by the submission pipeline when a write-verification or
  // antivirus failure quarantined the file: the row still exists for
  // audit, but a REJECTED deposit never counts as "submitted" and is
  // filtered out of every "current submission" read by the UI.
  status: z.enum(['RECEIVED', 'REJECTED']).default('RECEIVED'),
  reviewNote: z.string().trim().min(1).max(500).optional(),
});
export type CreateOwnDiagnosticSubmissionInput = z.input<typeof createSubmissionSchema>;

/**
 * Self-service deposit: creates a NEW versioned row (never updates a prior
 * one). The caller must have already written the file bytes to
 * `storageKey` before calling this (see lib/core-v2/diagnostics/storage.ts)
 * — this function only records the deposit and computes the next version
 * number transactionally, so two concurrent deposits for the same
 * assignment can never collide on the same version.
 */
export async function createOwnDiagnosticSubmission(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: CreateOwnDiagnosticSubmissionInput,
): Promise<DiagnosticSubmission> {
  const student = await loadOwnStudentOrThrow(client, ctx);
  const input = parseInput(createSubmissionSchema, rawInput);

  return inTransaction(client, async (tx) => {
    const assignment = await tx.diagnosticAssignment.findFirst({
      where: { id: input.assignmentId, studentId: student.id },
    });
    if (!assignment) throw new NotFoundError('Assignment not found.', { assignmentId: input.assignmentId });
    if (assignment.status === 'REVOKED') {
      throw new InvalidStateError('This attribution has been revoked; no further deposit is accepted.', {
        assignmentId: input.assignmentId,
      });
    }

    const lastVersion = await tx.diagnosticSubmission.aggregate({
      where: { assignmentId: assignment.id },
      _max: { version: true },
    });
    const nextVersion = (lastVersion._max.version ?? 0) + 1;

    let submission: DiagnosticSubmission;
    try {
      submission = await tx.diagnosticSubmission.create({
        data: {
          assignmentId: assignment.id,
          version: nextVersion,
          storageKey: input.storageKey,
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          sha256: input.sha256,
          status: input.status,
          reviewNote: input.reviewNote,
          submittedById: ctx.actor.userId,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // A concurrent deposit for the same assignment computed the same
        // "next version" first — the loser must be told plainly, never as
        // a raw driver error, so a caller (the submission pipeline) can
        // reliably quarantine its own already-finalized file.
        throw new ConflictError('Another deposit for this assignment was recorded first; retry to get the next version.', {
          assignmentId: assignment.id,
          attemptedVersion: nextVersion,
        });
      }
      throw error;
    }

    if (input.status !== 'REJECTED' && assignment.status === 'ASSIGNED') {
      await tx.diagnosticAssignment.update({ where: { id: assignment.id }, data: { status: 'SUBMITTED' } });
    }

    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'diagnostic.submission.deposited',
      subjectType: 'DiagnosticSubmission',
      subjectId: submission.id,
      correlationId: ctx.correlationId,
      metadata: { assignmentId: assignment.id, version: nextVersion, sizeBytes: input.sizeBytes, status: input.status },
    });

    return submission;
  });
}
