import 'server-only';

import type { Prisma } from '@prisma/client';

import { AssessmentEngineError } from './errors';
import { sha256 } from './hash';
import {
  manualReviewDecisionCommandSchema,
  manualReviewRevisionCommandSchema,
  type ManualReviewDecisionCommand,
  type ManualReviewRevisionCommand,
} from './schemas';
import {
  assertActorIdentity,
  auditActor,
  engineNow,
  runIdempotently,
  type AssessmentEngineActor,
  type AssessmentEngineContext,
} from './workflow-service';

function manualTaskProjection(task: Readonly<{
  id: string;
  assessmentAttemptId: string;
  responseId: string;
  status: string;
  claimedByUserId: string | null;
  claimLeaseExpiresAt: Date | null;
  claimVersion: number;
  completedAt: Date | null;
  currentDecisionId: string | null;
}>) {
  return {
    id: task.id,
    attemptId: task.assessmentAttemptId,
    responseId: task.responseId,
    status: task.status,
    claimedByUserId: task.claimedByUserId,
    claimLeaseExpiresAt: task.claimLeaseExpiresAt?.toISOString() ?? null,
    claimVersion: task.claimVersion,
    completedAt: task.completedAt?.toISOString() ?? null,
    currentDecisionId: task.currentDecisionId,
  };
}

function staffTaskWhere(
  actor: AssessmentEngineActor,
  taskId: string,
): Prisma.CanonicalManualReviewTaskWhereInput {
  if (actor.role === 'ADMIN') return { id: taskId };
  if (actor.role === 'COACH') {
    return {
      id: taskId,
      assessmentAttempt: {
        assignment: {
          bilanRequest: {
            assignedCoach: { userId: actor.userId },
          },
        },
      },
    };
  }
  return { id: '__forbidden__' };
}

async function createScoringJob(
  tx: Prisma.TransactionClient,
  attemptId: string,
  decisionVersion: number,
) {
  await tx.jobOutbox.create({
    data: {
      jobType: 'SCORE_ATTEMPT',
      aggregateType: 'CanonicalAssessmentAttempt',
      aggregateId: attemptId,
      sourceEventKey: `${attemptId}.manual-review.${decisionVersion}`,
      idempotencyKey: `${attemptId}.score.final.${decisionVersion}`,
      payload: {
        attemptId,
        resultKind: 'FINAL',
        manualDecisionVersion: decisionVersion,
      },
    },
  });
}

export async function claimManualReviewTask(
  context: AssessmentEngineContext,
  input: Readonly<{
    actor: AssessmentEngineActor;
    taskId: string;
    leaseSeconds: number;
    idempotencyKey: string;
  }>,
) {
  if (
    !Number.isInteger(input.leaseSeconds)
    || input.leaseSeconds < 30
    || input.leaseSeconds > 1_800
  ) {
    throw new AssessmentEngineError('INVALID_RESPONSE', 400);
  }
  const now = engineNow(context);
  const leaseExpiresAt = new Date(now.getTime() + input.leaseSeconds * 1_000);
  return context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(tx, input.actor, ['COACH', 'ADMIN']);
    return runIdempotently(tx, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      payload: {
        leaseSeconds: input.leaseSeconds,
        taskId: input.taskId,
      },
      scope: 'CLAIM_MANUAL_REVIEW',
      load: async (id) => {
        const task = await tx.canonicalManualReviewTask.findFirst({
          where: staffTaskWhere(input.actor, id),
        });
        return task ? manualTaskProjection(task) : null;
      },
      execute: async () => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "canonical_manual_review_tasks"
          WHERE "id" = ${input.taskId}
          FOR UPDATE
        `;
        const task = await tx.canonicalManualReviewTask.findFirst({
          where: staffTaskWhere(input.actor, input.taskId),
          include: {
            assessmentAttempt: {
              include: {
                assignment: {
                  select: {
                    bilanRequestId: true,
                    id: true,
                  },
                },
              },
            },
          },
        });
        if (!task || !task.assessmentAttempt.assignment) {
          throw new AssessmentEngineError('MANUAL_REVIEW_NOT_FOUND', 404);
        }
        const claimable = task.status === 'PENDING'
          || (
            task.status === 'CLAIMED'
            && task.claimLeaseExpiresAt !== null
            && task.claimLeaseExpiresAt <= now
          );
        if (!claimable) {
          throw new AssessmentEngineError('MANUAL_REVIEW_NOT_AVAILABLE');
        }
        const claimed = await tx.canonicalManualReviewTask.update({
          where: { id: task.id },
          data: {
            status: 'CLAIMED',
            claimedByUserId: input.actor.userId,
            claimLeaseExpiresAt: leaseExpiresAt,
            claimVersion: { increment: 1 },
          },
        });
        await tx.assessmentAuditEvent.create({
          data: {
            bilanRequestId: task.assessmentAttempt.assignment.bilanRequestId,
            assignmentId: task.assessmentAttempt.assignment.id,
            assessmentAttemptId: task.assessmentAttemptId,
            eventType: 'MANUAL_REVIEW_CLAIMED',
            actorUserId: input.actor.userId,
            actor: auditActor(input.actor),
            correlationId: `corr_${input.idempotencyKey}`,
            payload: {
              claimVersion: claimed.claimVersion,
              taskId: claimed.id,
            },
          },
        });
        return manualTaskProjection(claimed);
      },
    });
  });
}

function completedDecisionProjection(task: Readonly<{
  id: string;
  currentDecision: Readonly<{
    id: string;
    version: number;
  }> | null;
}>) {
  if (!task.currentDecision) return null;
  return {
    id: task.id,
    taskId: task.id,
    decisionId: task.currentDecision.id,
    decisionVersion: task.currentDecision.version,
  };
}

export async function completeManualReviewTask(
  context: AssessmentEngineContext,
  input: Readonly<{
    actor: AssessmentEngineActor;
    command: ManualReviewDecisionCommand;
    idempotencyKey: string;
  }>,
) {
  const command = manualReviewDecisionCommandSchema.parse(input.command);
  const now = engineNow(context);
  return context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(tx, input.actor, ['COACH', 'ADMIN']);
    return runIdempotently(tx, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      payload: command,
      scope: 'COMPLETE_MANUAL_REVIEW',
      load: async (id) => {
        const task = await tx.canonicalManualReviewTask.findFirst({
          where: staffTaskWhere(input.actor, id),
          include: {
            currentDecision: {
              select: { id: true, version: true },
            },
          },
        });
        return task ? completedDecisionProjection(task) : null;
      },
      execute: async () => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "canonical_manual_review_tasks"
          WHERE "id" = ${command.taskId}
          FOR UPDATE
        `;
        const task = await tx.canonicalManualReviewTask.findFirst({
          where: staffTaskWhere(input.actor, command.taskId),
          include: {
            assessmentAttempt: {
              include: {
                assignment: {
                  select: {
                    bilanRequestId: true,
                    id: true,
                  },
                },
              },
            },
          },
        });
        if (!task || !task.assessmentAttempt.assignment) {
          throw new AssessmentEngineError('MANUAL_REVIEW_NOT_FOUND', 404);
        }
        if (
          task.status !== 'CLAIMED'
          || task.claimedByUserId !== input.actor.userId
          || task.claimVersion !== command.expectedClaimVersion
        ) {
          throw new AssessmentEngineError('MANUAL_REVIEW_NOT_AVAILABLE');
        }
        if (!task.claimLeaseExpiresAt || task.claimLeaseExpiresAt <= now) {
          throw new AssessmentEngineError('MANUAL_REVIEW_LEASE_EXPIRED');
        }
        const decision = await tx.canonicalManualReviewDecision.create({
          data: {
            taskId: task.id,
            version: 1,
            reviewerUserId: input.actor.userId,
            awardedPoints: command.awardedPoints,
            maxPoints: 1,
            internalComment: command.internalComment,
            publishableComment: command.publishableComment,
            rubricVersion: command.rubricVersion,
            idempotencyKey: input.idempotencyKey,
            idempotencyRequestHash: sha256(command),
            decidedAt: now,
          },
        });
        await tx.canonicalManualReviewTask.update({
          where: { id: task.id },
          data: {
            status: 'COMPLETED',
            currentDecisionId: decision.id,
            completedAt: now,
            claimLeaseExpiresAt: null,
          },
        });
        const remaining = await tx.canonicalManualReviewTask.count({
          where: {
            assessmentAttemptId: task.assessmentAttemptId,
            status: { not: 'COMPLETED' },
          },
        });
        if (remaining === 0) {
          await tx.canonicalAssessmentAttempt.updateMany({
            where: {
              id: task.assessmentAttemptId,
              status: 'PENDING_MANUAL_REVIEW',
            },
            data: { status: 'SUBMITTED' },
          });
          await createScoringJob(tx, task.assessmentAttemptId, decision.version);
        }
        await tx.assessmentAuditEvent.create({
          data: {
            bilanRequestId: task.assessmentAttempt.assignment.bilanRequestId,
            assignmentId: task.assessmentAttempt.assignment.id,
            assessmentAttemptId: task.assessmentAttemptId,
            eventType: 'MANUAL_REVIEW_COMPLETED',
            actorUserId: input.actor.userId,
            actor: auditActor(input.actor),
            correlationId: `corr_${input.idempotencyKey}`,
            payload: {
              decisionVersion: decision.version,
              taskId: task.id,
            },
          },
        });
        return {
          id: task.id,
          taskId: task.id,
          decisionId: decision.id,
          decisionVersion: decision.version,
        };
      },
    });
  });
}

export async function reviseManualReviewDecision(
  context: AssessmentEngineContext,
  input: Readonly<{
    actor: AssessmentEngineActor;
    command: ManualReviewRevisionCommand;
    idempotencyKey: string;
  }>,
) {
  const command = manualReviewRevisionCommandSchema.parse(input.command);
  const now = engineNow(context);
  return context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(tx, input.actor, ['COACH', 'ADMIN']);
    return runIdempotently(tx, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      payload: command,
      scope: 'COMPLETE_MANUAL_REVIEW',
      load: async (id) => {
        const task = await tx.canonicalManualReviewTask.findFirst({
          where: staffTaskWhere(input.actor, id),
          include: {
            currentDecision: {
              select: { id: true, version: true },
            },
          },
        });
        return task ? completedDecisionProjection(task) : null;
      },
      execute: async () => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "canonical_manual_review_tasks"
          WHERE "id" = ${command.taskId}
          FOR UPDATE
        `;
        const task = await tx.canonicalManualReviewTask.findFirst({
          where: staffTaskWhere(input.actor, command.taskId),
          include: {
            assessmentAttempt: {
              include: {
                assignment: {
                  select: {
                    bilanRequestId: true,
                    id: true,
                  },
                },
              },
            },
            currentDecision: true,
          },
        });
        if (
          !task
          || !task.assessmentAttempt.assignment
          || task.status !== 'COMPLETED'
          || !task.currentDecision
        ) {
          throw new AssessmentEngineError('MANUAL_REVIEW_NOT_FOUND', 404);
        }
        const version = task.currentDecision.version + 1;
        const decision = await tx.canonicalManualReviewDecision.create({
          data: {
            taskId: task.id,
            version,
            reviewerUserId: input.actor.userId,
            awardedPoints: command.awardedPoints,
            maxPoints: 1,
            internalComment: command.internalComment,
            publishableComment: command.publishableComment,
            rubricVersion: command.rubricVersion,
            supersedesDecisionId: task.currentDecision.id,
            idempotencyKey: input.idempotencyKey,
            idempotencyRequestHash: sha256(command),
            decidedAt: now,
          },
        });
        await tx.canonicalManualReviewTask.update({
          where: { id: task.id },
          data: { currentDecisionId: decision.id },
        });
        await createScoringJob(tx, task.assessmentAttemptId, version);
        await tx.assessmentAuditEvent.create({
          data: {
            bilanRequestId: task.assessmentAttempt.assignment.bilanRequestId,
            assignmentId: task.assessmentAttempt.assignment.id,
            assessmentAttemptId: task.assessmentAttemptId,
            eventType: 'MANUAL_REVIEW_REVISED',
            actorUserId: input.actor.userId,
            actor: auditActor(input.actor),
            correlationId: `corr_${input.idempotencyKey}`,
            payload: {
              decisionVersion: version,
              taskId: task.id,
            },
          },
        });
        return {
          id: task.id,
          taskId: task.id,
          decisionId: decision.id,
          decisionVersion: version,
        };
      },
    });
  });
}
