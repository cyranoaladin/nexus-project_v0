import 'server-only';

import { randomUUID } from 'node:crypto';

import {
  Prisma,
  type PrismaClient,
} from '@prisma/client';

import { createPublicAssessmentDefinition } from '@/lib/pre-rentree/pedagogy/public-definition';
import type {
  AssessmentDefinition,
  PedagogyCatalog,
} from '@/lib/pre-rentree/pedagogy/types';

import { AssessmentEngineError } from './errors';
import { sha256 } from './hash';
import {
  assignmentCommandSchema,
  autosaveCommandSchema,
  idempotencyKeySchema,
  submitCommandSchema,
  type AssignmentCommand,
  type AutosaveCommand,
  type SubmitCommand,
} from './schemas';

type TransactionClient = Prisma.TransactionClient;

export type AssessmentEngineActor = Readonly<{
  userId: string;
  role: 'PARENT' | 'ELEVE' | 'ASSISTANTE' | 'COACH' | 'ADMIN';
}>;

export type AssessmentEngineContext = Readonly<{
  prisma: PrismaClient;
  catalog: PedagogyCatalog;
  now?: () => Date;
}>;

type IdempotencyScope =
  | 'CREATE_ASSIGNMENT'
  | 'START_ATTEMPT'
  | 'AUTOSAVE_RESPONSE'
  | 'SUBMIT_ATTEMPT';

type IdempotentResource = Readonly<{ id: string }>;

function engineNow(context: AssessmentEngineContext): Date {
  return context.now?.() ?? new Date();
}

function actorKey(actor: AssessmentEngineActor): string {
  return `user:${actor.userId}`;
}

function auditActor(
  actor: AssessmentEngineActor,
): 'PARENT_FLOW' | 'ASSISTANTE' | 'COACH' | 'ADMIN' {
  if (actor.role === 'PARENT' || actor.role === 'ELEVE') return 'PARENT_FLOW';
  return actor.role;
}

function assertIdempotencyKey(value: string): string {
  const parsed = idempotencyKeySchema.safeParse(value);
  if (!parsed.success) throw new AssessmentEngineError('INVALID_RESPONSE', 400);
  return parsed.data;
}

async function assertActorIdentity(
  tx: TransactionClient,
  actor: AssessmentEngineActor,
  allowedRoles: readonly AssessmentEngineActor['role'][],
): Promise<void> {
  if (!allowedRoles.includes(actor.role)) {
    throw new AssessmentEngineError('ROLE_FORBIDDEN', 403);
  }
  const identity = await tx.user.findFirst({
    where: { id: actor.userId, role: actor.role },
    select: { id: true },
  });
  if (!identity) throw new AssessmentEngineError('ROLE_FORBIDDEN', 403);
}

async function runIdempotently<T extends IdempotentResource>(
  tx: TransactionClient,
  input: Readonly<{
    actor: AssessmentEngineActor;
    idempotencyKey: string;
    payload: unknown;
    scope: IdempotencyScope;
    load: (resourceId: string) => Promise<T | null>;
    execute: () => Promise<T>;
  }>,
): Promise<T> {
  const idempotencyKey = assertIdempotencyKey(input.idempotencyKey);
  const requestHash = sha256(input.payload);
  const recordId = randomUUID();
  const inserted = await tx.assessmentIdempotencyRecord.createMany({
    data: [{
      id: recordId,
      scope: input.scope,
      actorKey: actorKey(input.actor),
      idempotencyKey,
      requestHash,
      status: 'IN_PROGRESS',
    }],
    skipDuplicates: true,
  });

  if (inserted.count === 0) {
    const existing = await tx.assessmentIdempotencyRecord.findUnique({
      where: {
        scope_actorKey_idempotencyKey: {
          scope: input.scope,
          actorKey: actorKey(input.actor),
          idempotencyKey,
        },
      },
      select: {
        requestHash: true,
        resourceId: true,
        status: true,
      },
    });
    if (!existing || existing.requestHash !== requestHash) {
      throw new AssessmentEngineError('IDEMPOTENCY_PAYLOAD_MISMATCH');
    }
    if (existing.status !== 'COMPLETED' || !existing.resourceId) {
      throw new AssessmentEngineError('IDEMPOTENCY_IN_PROGRESS');
    }
    const replayed = await input.load(existing.resourceId);
    if (!replayed) throw new AssessmentEngineError('IDEMPOTENCY_IN_PROGRESS');
    return replayed;
  }

  const resource = await input.execute();
  await tx.assessmentIdempotencyRecord.update({
    where: { id: recordId },
    data: {
      status: 'COMPLETED',
      resourceId: resource.id,
      response: { resourceId: resource.id },
    },
  });
  return resource;
}

function assignmentProjection(assignment: Readonly<{
  id: string;
  bilanRequestId: string;
  studentId: string;
  definitionId: string;
  moduleId: string;
  definitionVersion: string;
  definitionChecksum: string;
  opensAt: Date;
  dueAt: Date | null;
  status: string;
  maxAttempts: number;
}>) {
  return {
    id: assignment.id,
    requestId: assignment.bilanRequestId,
    studentId: assignment.studentId,
    definitionId: assignment.definitionId,
    moduleId: assignment.moduleId,
    definitionVersion: assignment.definitionVersion,
    definitionChecksum: assignment.definitionChecksum,
    opensAt: assignment.opensAt,
    dueAt: assignment.dueAt,
    status: assignment.status,
    maxAttempts: assignment.maxAttempts,
  };
}

function attemptProjection(attempt: Readonly<{
  id: string;
  assignmentId: string | null;
  attemptNumber: number | null;
  status: string;
  startedAt: Date;
  lastAutosavedAt: Date | null;
  submittedAt: Date | null;
  sealedAt: Date | null;
}>) {
  return {
    id: attempt.id,
    assignmentId: attempt.assignmentId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt,
    lastAutosavedAt: attempt.lastAutosavedAt,
    submittedAt: attempt.submittedAt,
    sealedAt: attempt.sealedAt,
  };
}

function assignmentAccessWhere(
  actor: AssessmentEngineActor,
  assignmentId: string,
): Prisma.CanonicalAssessmentAssignmentWhereInput {
  if (actor.role === 'ADMIN') return { id: assignmentId };
  if (actor.role === 'PARENT') {
    return {
      id: assignmentId,
      bilanRequest: { parentUserId: actor.userId },
      student: {
        parentLinks: {
          some: {
            parentUserId: actor.userId,
            state: 'VERIFIED',
            revokedAt: null,
          },
        },
      },
    };
  }
  if (actor.role === 'ELEVE') {
    return {
      id: assignmentId,
      student: { userId: actor.userId },
    };
  }
  return { id: '__forbidden__' };
}

function attemptAccessWhere(
  actor: AssessmentEngineActor,
  attemptId: string,
): Prisma.CanonicalAssessmentAttemptWhereInput {
  const assignmentWhere = assignmentAccessWhere(actor, '__placeholder__');
  delete assignmentWhere.id;
  return {
    id: attemptId,
    assignment: assignmentWhere,
  };
}

function assertDefinitionReference(
  definition: AssessmentDefinition,
  command: AssignmentCommand,
): void {
  if (
    definition.ref.definitionId !== command.definitionId
    || definition.ref.version !== command.definitionVersion
    || definition.ref.sha256 !== command.definitionChecksum
  ) {
    throw new AssessmentEngineError('CATALOG_REFERENCE_MISMATCH', 400);
  }
}

export async function createAssessmentAssignment(
  context: AssessmentEngineContext,
  input: Readonly<{
    actor: AssessmentEngineActor;
    command: AssignmentCommand;
    idempotencyKey: string;
  }>,
) {
  const command = assignmentCommandSchema.parse(input.command);
  const definition = context.catalog.getAssessment(
    command.definitionId,
    'ASSIGNMENT',
  );
  assertDefinitionReference(definition, command);
  const moduleDefinition = context.catalog.getModule(definition.moduleId);
  const now = engineNow(context);

  return context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(tx, input.actor, ['ASSISTANTE', 'ADMIN']);
    return runIdempotently(tx, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      payload: command,
      scope: 'CREATE_ASSIGNMENT',
      load: async (id) => {
        const assignment = await tx.canonicalAssessmentAssignment.findUnique({
          where: { id },
        });
        return assignment ? assignmentProjection(assignment) : null;
      },
      execute: async () => {
        const request = await tx.bilanRequest.findFirst({
          where: {
            id: command.requestId,
            studentId: command.studentId,
            status: {
              in: ['READY_FOR_ASSESSMENT', 'ASSESSMENT_IN_PROGRESS'],
            },
          },
          select: {
            gradeLevel: true,
            id: true,
            studentId: true,
            subject: true,
          },
        });
        if (!request) throw new AssessmentEngineError('ASSIGNMENT_NOT_FOUND', 404);
        if (
          request.subject !== definition.subject
          || request.gradeLevel !== definition.level
          || moduleDefinition.publicationStatus !== 'PUBLICATION_APPROVED'
        ) {
          throw new AssessmentEngineError('CATALOG_REFERENCE_MISMATCH', 400);
        }
        const opensAt = new Date(command.opensAt);
        const assignment = await tx.canonicalAssessmentAssignment.create({
          data: {
            bilanRequestId: request.id,
            studentId: command.studentId,
            definitionId: definition.id,
            moduleId: definition.moduleId,
            definitionVersion: definition.ref.version,
            definitionChecksum: definition.ref.sha256,
            manifestVersion: context.catalog.version.manifestVersion,
            manifestChecksum: context.catalog.version.manifestSha256,
            moduleCatalogVersion: context.catalog.version.moduleCatalogVersion,
            moduleCatalogChecksum: context.catalog.version.moduleCatalogSha256,
            resolvedAt: now,
            opensAt,
            dueAt: command.dueAt ? new Date(command.dueAt) : null,
            status: opensAt <= now ? 'AVAILABLE' : 'ASSIGNED',
            maxAttempts: command.maxAttempts,
            assignedByUserId: input.actor.userId,
            idempotencyKey: input.idempotencyKey,
            idempotencyRequestHash: sha256(command),
          },
        });
        await tx.assessmentAuditEvent.create({
          data: {
            bilanRequestId: request.id,
            assignmentId: assignment.id,
            eventType: 'ASSIGNMENT_CREATED',
            actorUserId: input.actor.userId,
            actor: auditActor(input.actor),
            correlationId: `corr_${input.idempotencyKey}`,
            payload: {
              definitionId: definition.id,
              definitionVersion: definition.ref.version,
            },
          },
        });
        return assignmentProjection(assignment);
      },
    });
  });
}

export async function getAssignmentPublicDefinition(
  context: AssessmentEngineContext,
  input: Readonly<{
    actor: AssessmentEngineActor;
    assignmentId: string;
  }>,
) {
  const assignment = await context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(tx, input.actor, ['PARENT', 'ELEVE', 'ADMIN']);
    return tx.canonicalAssessmentAssignment.findFirst({
      where: assignmentAccessWhere(input.actor, input.assignmentId),
      select: {
        definitionChecksum: true,
        definitionId: true,
        definitionVersion: true,
        moduleId: true,
      },
    });
  });
  if (!assignment) throw new AssessmentEngineError('ASSIGNMENT_NOT_FOUND', 404);
  const definition = context.catalog.assertAssessmentRef({
    definitionId: assignment.definitionId,
    moduleId: assignment.moduleId,
    version: assignment.definitionVersion,
    sha256: assignment.definitionChecksum as `sha256:${string}`,
  });
  return createPublicAssessmentDefinition(definition);
}

export async function startAssessmentAttempt(
  context: AssessmentEngineContext,
  input: Readonly<{
    actor: AssessmentEngineActor;
    assignmentId: string;
    idempotencyKey: string;
  }>,
) {
  const now = engineNow(context);
  return context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(tx, input.actor, ['PARENT', 'ELEVE', 'ADMIN']);
    return runIdempotently(tx, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      payload: { assignmentId: input.assignmentId },
      scope: 'START_ATTEMPT',
      load: async (id) => {
        const attempt = await tx.canonicalAssessmentAttempt.findFirst({
          where: attemptAccessWhere(input.actor, id),
        });
        return attempt ? attemptProjection(attempt) : null;
      },
      execute: async () => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "canonical_assessment_assignments"
          WHERE "id" = ${input.assignmentId}
          FOR UPDATE
        `;
        const assignment = await tx.canonicalAssessmentAssignment.findFirst({
          where: assignmentAccessWhere(input.actor, input.assignmentId),
          include: {
            bilanRequest: {
              select: {
                gradeLevel: true,
                schoolYear: true,
                subject: true,
              },
            },
          },
        });
        if (!assignment) {
          throw new AssessmentEngineError('ASSIGNMENT_NOT_FOUND', 404);
        }
        if (assignment.dueAt && assignment.dueAt <= now) {
          if (assignment.status === 'ASSIGNED' || assignment.status === 'AVAILABLE') {
            await tx.canonicalAssessmentAssignment.update({
              where: { id: assignment.id },
              data: { status: 'CLOSED', closedAt: now },
            });
          }
          throw new AssessmentEngineError('ASSIGNMENT_NOT_AVAILABLE');
        }
        if (assignment.status === 'ASSIGNED' && assignment.opensAt <= now) {
          await tx.canonicalAssessmentAssignment.update({
            where: { id: assignment.id },
            data: { status: 'AVAILABLE' },
          });
        } else if (
          assignment.status !== 'AVAILABLE'
          || assignment.opensAt > now
        ) {
          throw new AssessmentEngineError('ASSIGNMENT_NOT_AVAILABLE');
        }

        const active = await tx.canonicalAssessmentAttempt.findFirst({
          where: {
            assignmentId: assignment.id,
            status: 'IN_PROGRESS',
          },
          orderBy: { attemptNumber: 'desc' },
        });
        if (active) return attemptProjection(active);
        const latest = await tx.canonicalAssessmentAttempt.aggregate({
          where: { assignmentId: assignment.id },
          _max: { attemptNumber: true },
          _count: { id: true },
        });
        if (latest._count.id >= assignment.maxAttempts) {
          throw new AssessmentEngineError('ATTEMPT_LIMIT_REACHED');
        }
        const attempt = await tx.canonicalAssessmentAttempt.create({
          data: {
            assignmentId: assignment.id,
            attemptNumber: (latest._max.attemptNumber ?? 0) + 1,
            studentId: assignment.studentId,
            status: 'IN_PROGRESS',
            subject: assignment.bilanRequest.subject,
            gradeLevel: assignment.bilanRequest.gradeLevel,
            answers: {},
            startedAt: now,
            curriculumId: context.catalog.version.campaignId,
            curriculumVersion: context.catalog.version.moduleCatalogVersion,
            assessmentPackId: assignment.definitionId,
            assessmentPackVersion: assignment.definitionVersion,
            assessmentPackChecksum: assignment.definitionChecksum,
            scoringPolicyId: 'canonical-raw-item-score',
            scoringPolicyVersion: '1.0.0',
          },
        });
        await tx.bilanRequest.update({
          where: { id: assignment.bilanRequestId },
          data: {
            canonicalAttemptId: attempt.id,
            status: 'ASSESSMENT_IN_PROGRESS',
            lastActivityAt: now,
          },
        });
        await tx.assessmentAuditEvent.create({
          data: {
            bilanRequestId: assignment.bilanRequestId,
            assignmentId: assignment.id,
            assessmentAttemptId: attempt.id,
            eventType: 'ATTEMPT_STARTED',
            actorUserId: input.actor.userId,
            actor: auditActor(input.actor),
            correlationId: `corr_${input.idempotencyKey}`,
            payload: { attemptNumber: attempt.attemptNumber ?? 1 },
          },
        });
        return attemptProjection(attempt);
      },
    });
  });
}

function resolveAttemptDefinition(
  context: AssessmentEngineContext,
  attempt: Readonly<{
    assessmentPackChecksum: string;
    assessmentPackId: string;
    assessmentPackVersion: string;
    assignment: Readonly<{ moduleId: string }> | null;
  }>,
): AssessmentDefinition {
  if (!attempt.assignment) {
    throw new AssessmentEngineError('ATTEMPT_NOT_FOUND', 404);
  }
  return context.catalog.assertAssessmentRef({
    definitionId: attempt.assessmentPackId,
    moduleId: attempt.assignment.moduleId,
    version: attempt.assessmentPackVersion,
    sha256: attempt.assessmentPackChecksum as `sha256:${string}`,
  });
}

export async function autosaveAssessmentResponse(
  context: AssessmentEngineContext,
  input: Readonly<{
    actor: AssessmentEngineActor;
    command: AutosaveCommand;
    idempotencyKey: string;
  }>,
) {
  const command = autosaveCommandSchema.parse(input.command);
  const now = engineNow(context);
  return context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(tx, input.actor, ['PARENT', 'ELEVE', 'ADMIN']);
    return runIdempotently(tx, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      payload: command,
      scope: 'AUTOSAVE_RESPONSE',
      load: async (id) => {
        const response = await tx.canonicalAssessmentResponse.findUnique({
          where: { id },
          select: {
            id: true,
            itemId: true,
            lastAutosavedAt: true,
            version: true,
          },
        });
        return response;
      },
      execute: async () => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "canonical_assessment_attempts"
          WHERE "id" = ${command.attemptId}
          FOR UPDATE
        `;
        const attempt = await tx.canonicalAssessmentAttempt.findFirst({
          where: attemptAccessWhere(input.actor, command.attemptId),
          include: {
            assignment: {
              select: {
                bilanRequestId: true,
                id: true,
                moduleId: true,
              },
            },
          },
        });
        if (!attempt) throw new AssessmentEngineError('ATTEMPT_NOT_FOUND', 404);
        if (attempt.status !== 'IN_PROGRESS' || attempt.sealedAt) {
          throw new AssessmentEngineError('ATTEMPT_NOT_EDITABLE');
        }
        const definition = resolveAttemptDefinition(context, attempt);
        const item = definition.items.find(({ id }) => id === command.itemId);
        if (!item) throw new AssessmentEngineError('ITEM_NOT_IN_DEFINITION', 400);

        const selectedOptionIndex = command.response.selectedOptionIndex;
        const textValue = command.response.textValue;
        const isQcm = selectedOptionIndex !== undefined;
        if (
          (item.responseMode === 'AUTOMATIC_QCM' && !isQcm)
          || (item.responseMode === 'MANUAL_SHORT_RESPONSE' && isQcm)
        ) {
          throw new AssessmentEngineError('INVALID_RESPONSE', 400);
        }
        if (
          !isQcm
          && (textValue?.length ?? 0) > (item.maxCharacters ?? 2_000)
        ) {
          throw new AssessmentEngineError('INVALID_RESPONSE', 400);
        }

        const existing = await tx.canonicalAssessmentResponse.findUnique({
          where: {
            assessmentAttemptId_itemId: {
              assessmentAttemptId: attempt.id,
              itemId: item.id,
            },
          },
        });
        if (existing && existing.version !== command.expectedVersion) {
          throw new AssessmentEngineError('RESPONSE_VERSION_CONFLICT');
        }
        if (!existing && command.expectedVersion !== 0) {
          throw new AssessmentEngineError('RESPONSE_VERSION_CONFLICT');
        }
        let response;
        if (isQcm) {
          const option = item.options?.[selectedOptionIndex];
          response = existing
            ? await tx.canonicalAssessmentResponse.update({
              where: { id: existing.id },
              data: {
                selectedOptionIndex,
                automaticOutcome: option
                  ? option.correct ? 'AUTOMATIC_CORRECT' : 'INCORRECT'
                  : 'TECHNICALLY_INVALID',
                automaticPoints: option ? option.correct ? 1 : 0 : null,
                version: { increment: 1 },
                lastAutosavedAt: now,
              },
            })
            : await tx.canonicalAssessmentResponse.create({
              data: {
                assessmentAttemptId: attempt.id,
                itemId: item.id,
                responseType: 'AUTOMATIC_QCM',
                selectedOptionIndex,
                automaticOutcome: option
                  ? option.correct ? 'AUTOMATIC_CORRECT' : 'INCORRECT'
                  : 'TECHNICALLY_INVALID',
                automaticPoints: option ? option.correct ? 1 : 0 : null,
                version: 1,
                lastAutosavedAt: now,
              },
            });
        } else {
          response = existing
            ? await tx.canonicalAssessmentResponse.update({
              where: { id: existing.id },
              data: {
                textValue,
                version: { increment: 1 },
                lastAutosavedAt: now,
              },
            })
            : await tx.canonicalAssessmentResponse.create({
              data: {
                assessmentAttemptId: attempt.id,
                itemId: item.id,
                responseType: 'MANUAL_SHORT_RESPONSE',
                textValue,
                version: 1,
                lastAutosavedAt: now,
              },
            });
        }
        await tx.canonicalAssessmentAttempt.update({
          where: { id: attempt.id },
          data: {
            lastAutosavedAt: now,
            version: { increment: 1 },
          },
        });
        await tx.assessmentAuditEvent.create({
          data: {
            bilanRequestId: attempt.assignment!.bilanRequestId,
            assignmentId: attempt.assignment!.id,
            assessmentAttemptId: attempt.id,
            eventType: 'RESPONSE_AUTOSAVED',
            actorUserId: input.actor.userId,
            actor: auditActor(input.actor),
            correlationId: `corr_${input.idempotencyKey}`,
            payload: {
              itemId: item.id,
              version: response.version,
            },
          },
        });
        return {
          id: response.id,
          itemId: response.itemId,
          lastAutosavedAt: response.lastAutosavedAt,
          version: response.version,
        };
      },
    });
  });
}

export async function submitAssessmentAttempt(
  context: AssessmentEngineContext,
  input: Readonly<{
    actor: AssessmentEngineActor;
    command: SubmitCommand;
    idempotencyKey: string;
  }>,
) {
  const command = submitCommandSchema.parse(input.command);
  const now = engineNow(context);
  return context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(tx, input.actor, ['PARENT', 'ELEVE', 'ADMIN']);
    return runIdempotently(tx, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      payload: command,
      scope: 'SUBMIT_ATTEMPT',
      load: async (id) => {
        const attempt = await tx.canonicalAssessmentAttempt.findFirst({
          where: attemptAccessWhere(input.actor, id),
        });
        return attempt ? attemptProjection(attempt) : null;
      },
      execute: async () => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "canonical_assessment_attempts"
          WHERE "id" = ${command.attemptId}
          FOR UPDATE
        `;
        const attempt = await tx.canonicalAssessmentAttempt.findFirst({
          where: attemptAccessWhere(input.actor, command.attemptId),
          include: {
            assignment: {
              select: {
                bilanRequestId: true,
                id: true,
                moduleId: true,
              },
            },
            responses: {
              orderBy: { itemId: 'asc' },
            },
          },
        });
        if (!attempt) throw new AssessmentEngineError('ATTEMPT_NOT_FOUND', 404);
        if (attempt.status !== 'IN_PROGRESS' || attempt.sealedAt) {
          if (attempt.sealedAt) return attemptProjection(attempt);
          throw new AssessmentEngineError('ATTEMPT_NOT_EDITABLE');
        }
        const definition = resolveAttemptDefinition(context, attempt);
        const knownItems = new Set(definition.items.map(({ id }) => id));
        if (attempt.responses.some(({ itemId }) => !knownItems.has(itemId))) {
          throw new AssessmentEngineError('ITEM_NOT_IN_DEFINITION', 400);
        }
        const submissionHash = sha256({
          attemptId: attempt.id,
          definitionRef: definition.ref,
          responses: attempt.responses.map((response) => ({
            itemId: response.itemId,
            responseType: response.responseType,
            selectedOptionIndex: response.selectedOptionIndex,
            textValue: response.textValue,
            version: response.version,
          })),
        });

        await tx.canonicalAssessmentResponse.updateMany({
          where: {
            assessmentAttemptId: attempt.id,
            sealedAt: null,
          },
          data: { sealedAt: now },
        });
        const manualResponses = attempt.responses.filter(
          ({ responseType }) => responseType === 'MANUAL_SHORT_RESPONSE',
        );
        if (manualResponses.length) {
          await tx.canonicalManualReviewTask.createMany({
            data: manualResponses.map((response) => ({
              responseId: response.id,
              assessmentAttemptId: attempt.id,
              status: 'PENDING' as const,
            })),
            skipDuplicates: true,
          });
        }
        const submitted = await tx.canonicalAssessmentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: manualResponses.length
              ? 'PENDING_MANUAL_REVIEW'
              : 'SUBMITTED',
            sealedAt: now,
            submittedAt: now,
            submissionHash,
            version: { increment: 1 },
          },
        });
        await tx.bilanRequest.update({
          where: { id: attempt.assignment!.bilanRequestId },
          data: {
            status: 'ASSESSMENT_SUBMITTED',
            submittedAt: now,
            lastActivityAt: now,
          },
        });
        await tx.assessmentAuditEvent.create({
          data: {
            bilanRequestId: attempt.assignment!.bilanRequestId,
            assignmentId: attempt.assignment!.id,
            assessmentAttemptId: attempt.id,
            eventType: 'ATTEMPT_SUBMITTED',
            actorUserId: input.actor.userId,
            actor: auditActor(input.actor),
            correlationId: `corr_${input.idempotencyKey}`,
            payload: {
              manualReviewCount: manualResponses.length,
              responseCount: attempt.responses.length,
            },
          },
        });
        if (!manualResponses.length) {
          await tx.jobOutbox.create({
            data: {
              jobType: 'SCORE_ATTEMPT',
              aggregateType: 'CanonicalAssessmentAttempt',
              aggregateId: attempt.id,
              sourceEventKey: `${attempt.id}.submitted`,
              idempotencyKey: `${attempt.id}.score.final`,
              payload: {
                attemptId: attempt.id,
                resultKind: 'FINAL',
              },
            },
          });
        }
        return attemptProjection(submitted);
      },
    });
  });
}
