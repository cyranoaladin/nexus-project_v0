import 'server-only';

import type { Prisma } from '@prisma/client';

import { AssessmentEngineError } from './errors';
import {
  computeCanonicalScore,
  type CanonicalScore,
} from './scoring';
import {
  assertActorIdentity,
  auditActor,
  engineNow,
  resolveAttemptDefinition,
  runIdempotently,
  type AssessmentEngineActor,
  type AssessmentEngineContext,
} from './workflow-service';

function staffAttemptWhere(
  actor: AssessmentEngineActor,
  attemptId: string,
): Prisma.CanonicalAssessmentAttemptWhereInput {
  if (actor.role === 'ADMIN' || actor.role === 'ASSISTANTE') {
    return { id: attemptId };
  }
  if (actor.role === 'COACH') {
    return {
      id: attemptId,
      assignment: {
        bilanRequest: {
          assignedCoach: { userId: actor.userId },
        },
      },
    };
  }
  return { id: '__forbidden__' };
}

function scoreProjection(score: Readonly<{
  id: string;
  assessmentAttemptId: string;
  calibrationStatus: string;
  inputChecksum: string | null;
  maxScore: number | null;
  resultKind: string;
  score: number;
  scoredAt: Date;
  scoringPolicyChecksum: string;
  scoringPolicyId: string;
  scoringPolicyVersion: string;
}>) {
  return {
    id: score.id,
    attemptId: score.assessmentAttemptId,
    resultKind: score.resultKind,
    score: score.score,
    maxScore: score.maxScore,
    inputChecksum: score.inputChecksum,
    calibrationStatus: score.calibrationStatus,
    scoringPolicyId: score.scoringPolicyId,
    scoringPolicyVersion: score.scoringPolicyVersion,
    scoringPolicyChecksum: score.scoringPolicyChecksum,
    scoredAt: score.scoredAt.toISOString(),
  };
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function scoreAssessmentAttempt(
  context: AssessmentEngineContext,
  input: Readonly<{
    actor: AssessmentEngineActor;
    attemptId: string;
    resultKind: 'PROVISIONAL' | 'FINAL';
    provisionalResultsEnabled: boolean;
    idempotencyKey: string;
  }>,
) {
  const now = engineNow(context);
  return context.prisma.$transaction(async (tx) => {
    await assertActorIdentity(
      tx,
      input.actor,
      ['ASSISTANTE', 'COACH', 'ADMIN'],
    );
    return runIdempotently(tx, {
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      payload: {
        attemptId: input.attemptId,
        resultKind: input.resultKind,
      },
      scope: 'SCORE_ATTEMPT',
      load: async (id) => {
        const score = await tx.scoreSnapshot.findFirst({
          where: {
            id,
            assessmentAttempt: staffAttemptWhere(input.actor, input.attemptId),
          },
        });
        return score ? scoreProjection(score) : null;
      },
      execute: async () => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "canonical_assessment_attempts"
          WHERE "id" = ${input.attemptId}
          FOR UPDATE
        `;
        const attempt = await tx.canonicalAssessmentAttempt.findFirst({
          where: staffAttemptWhere(input.actor, input.attemptId),
          include: {
            assignment: {
              select: {
                bilanRequestId: true,
                id: true,
                moduleId: true,
              },
            },
            manualReviewTasks: {
              include: {
                currentDecision: true,
                response: {
                  select: { itemId: true },
                },
              },
            },
            responses: {
              select: {
                itemId: true,
                responseType: true,
                selectedOptionIndex: true,
                textValue: true,
              },
            },
          },
        });
        if (!attempt || !attempt.assignment) {
          throw new AssessmentEngineError('ATTEMPT_NOT_FOUND', 404);
        }
        if (
          !attempt.sealedAt
          || ![
            'SUBMITTED',
            'PENDING_MANUAL_REVIEW',
            'SCORED',
          ].includes(attempt.status)
        ) {
          throw new AssessmentEngineError('ATTEMPT_NOT_EDITABLE');
        }
        const definition = resolveAttemptDefinition(context, attempt);
        const manualDecisions = attempt.manualReviewTasks.flatMap((task) => (
          task.currentDecision
            ? [{
              itemId: task.response.itemId,
              awardedPoints: task.currentDecision.awardedPoints,
              maxPoints: task.currentDecision.maxPoints,
              decisionVersion: task.currentDecision.version,
              internalComment: task.currentDecision.internalComment ?? undefined,
              publishableComment:
                task.currentDecision.publishableComment ?? undefined,
            }]
            : []
        ));
        const computed = computeCanonicalScore({
          definition,
          responses: attempt.responses,
          manualDecisions,
          resultKind: input.resultKind,
          provisionalResultsEnabled: input.provisionalResultsEnabled,
        });
        const existing = await tx.scoreSnapshot.findFirst({
          where: {
            assessmentAttemptId: attempt.id,
            scoringPolicyId: computed.policy.id,
            scoringPolicyVersion: computed.policy.version,
            inputChecksum: computed.inputChecksum,
            resultKind: input.resultKind,
          },
        });
        if (existing) return scoreProjection(existing);

        const score = await tx.scoreSnapshot.create({
          data: {
            assessmentAttemptId: attempt.id,
            scoringPolicyId: computed.policy.id,
            scoringPolicyVersion: computed.policy.version,
            scoringPolicyChecksum: computed.policy.checksum,
            inputChecksum: computed.inputChecksum,
            resultKind: computed.resultKind,
            score: computed.score,
            maxScore: computed.maxScore,
            result: asJson(computed),
            calibrationStatus: computed.calibrationStatus,
            scoredAt: now,
            evidenceItems: {
              create: computed.items.map((item) => ({
                kind: 'ANSWER' as const,
                competencyId: item.nodeId,
                sourceKey: item.itemId,
                payload: asJson({
                  maxPoints: item.maxPoints,
                  outcome: item.outcome,
                  points: item.points,
                }),
              })),
            },
          },
        });
        if (computed.resultKind === 'FINAL') {
          await tx.canonicalAssessmentAttempt.update({
            where: { id: attempt.id },
            data: {
              status: 'SCORED',
              version: { increment: 1 },
            },
          });
          await tx.bilanRequest.update({
            where: { id: attempt.assignment.bilanRequestId },
            data: {
              status: 'SCORED',
              lastActivityAt: now,
            },
          });
        }
        await tx.assessmentAuditEvent.create({
          data: {
            bilanRequestId: attempt.assignment.bilanRequestId,
            assignmentId: attempt.assignment.id,
            assessmentAttemptId: attempt.id,
            eventType: computed.resultKind === 'FINAL'
              ? 'SCORE_FINAL_CREATED'
              : 'SCORE_PROVISIONAL_CREATED',
            actorUserId: input.actor.userId,
            actor: auditActor(input.actor),
            correlationId: `corr_${input.idempotencyKey}`,
            payload: {
              resultKind: computed.resultKind,
              scoringPolicyVersion: computed.policy.version,
            },
          },
        });
        return scoreProjection(score);
      },
    });
  });
}

export function parseCanonicalScoreResult(value: Prisma.JsonValue): CanonicalScore {
  return value as unknown as CanonicalScore;
}
