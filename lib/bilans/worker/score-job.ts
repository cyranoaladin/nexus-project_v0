import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { resolveEnabledPack, type PackResolver } from '../api/pack-access';
import { advanceAttemptLifecycle, createPendingReport } from '../core/report-service';
import { sha256Canonical } from '../local-first/hash';
import type { DeterministicBilanReportBundle } from '../render/report';
import { buildWorkerScoring, type WorkerScoringDependencies } from './scoring';
import { prisma } from '@/lib/prisma';

const payloadSchema = z.object({
  attemptId: z.string().min(1),
  packSlug: z.string().min(1),
  packVersion: z.number().int().positive(),
}).strict();

type WorkerDatabase = Pick<PrismaClient, '$transaction' | 'jobOutbox'>;
type WorkerLogger = Readonly<{
  info(event: Readonly<Record<string, unknown>>): void;
  error(event: Readonly<Record<string, unknown>>): void;
}>;

export type ScoreJobDependencies = WorkerScoringDependencies & Readonly<{
  prisma: WorkerDatabase;
  resolvePack: PackResolver;
  now: () => Date;
  logger: WorkerLogger;
}>;

export class ScoreJobError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ScoreJobError';
  }
}

const defaultDependencies: ScoreJobDependencies = {
  prisma,
  resolvePack: resolveEnabledPack,
  now: () => new Date(),
  logger: {
    info: (event) => console.info(JSON.stringify(event)),
    error: (event) => console.error(JSON.stringify(event)),
  },
};

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function failureCode(stage: 'LOAD' | 'SCORING' | 'RENDER' | 'STRUCTURE'): string {
  if (stage === 'SCORING') return 'A86_SCORING_FAILED';
  if (stage === 'RENDER') return 'A86_RENDER_FAILED';
  if (stage === 'STRUCTURE') return 'A86_STRUCTURE_FAILED';
  return 'A86_WORKER_FAILED';
}

export async function processScoreAttemptJob(
  jobId: string,
  dependencies: ScoreJobDependencies = defaultDependencies,
) {
  const started = Date.now();
  let stage: 'LOAD' | 'SCORING' | 'RENDER' | 'STRUCTURE' = 'LOAD';
  try {
    const result = await dependencies.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{
        id: string;
        jobType: string;
        aggregateId: string;
        status: string;
        payload: unknown;
      }>>(Prisma.sql`
        SELECT "id", "jobType", "aggregateId", "status", "payload"
        FROM "canonical_job_outbox"
        WHERE "id" = ${jobId}
        FOR UPDATE
      `);
      const job = rows[0];
      if (job === undefined || job.jobType !== 'SCORE_ATTEMPT') throw new ScoreJobError('A86_JOB_INVALID');
      if (job.status === 'COMPLETED') {
        const snapshot = await transaction.scoreSnapshot.findUnique({ where: { assessmentAttemptId: job.aggregateId } });
        const artifact = await transaction.reportArtifact.findUnique({ where: { assessmentAttemptId: job.aggregateId } });
        if (snapshot === null || artifact === null) throw new ScoreJobError('A86_COMPLETED_JOB_INCONSISTENT');
        const revision = await transaction.reportRevision.findUnique({ where: { scoreSnapshotId: snapshot.id } });
        if (revision === null) throw new ScoreJobError('A86_COMPLETED_JOB_INCONSISTENT');
        return { jobId, snapshotId: snapshot.id, artifactId: artifact.id, revisionId: revision.id, replayed: true };
      }
      if (job.status !== 'PENDING' && job.status !== 'LEASED') throw new ScoreJobError('A86_JOB_NOT_PROCESSABLE');
      const payload = payloadSchema.parse(job.payload);
      if (payload.attemptId !== job.aggregateId) throw new ScoreJobError('A86_JOB_PAYLOAD_MISMATCH');
      const attempt = await transaction.canonicalAssessmentAttempt.findUnique({ where: { id: payload.attemptId } });
      if (attempt === null || attempt.status !== 'SUBMITTED' || attempt.submittedAt === null) {
        throw new ScoreJobError('A86_ATTEMPT_NOT_SUBMITTED');
      }
      const enabled = dependencies.resolvePack(payload.packSlug, payload.packVersion);
      if (
        enabled === null
        || attempt.assessmentPackId !== enabled.pack.slug
        || attempt.assessmentPackVersion !== String(enabled.pack.version)
        || attempt.assessmentPackChecksum !== enabled.checksum
      ) throw new ScoreJobError('A86_PACK_UNAVAILABLE');

      await transaction.jobOutbox.update({
        where: { id: job.id },
        data: {
          status: 'LEASED',
          leaseOwner: 'a86-deterministic-worker',
          leaseExpiresAt: new Date(dependencies.now().getTime() + 5 * 60_000),
        },
      });
      const computed = buildWorkerScoring({
        attemptId: attempt.id,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        answers: attempt.answers,
        pack: enabled.pack,
      }, {
        computeScoringV2: dependencies.computeScoringV2,
        computeFacts: dependencies.computeFacts,
        buildFactSheet: dependencies.buildFactSheet,
        buildReports: dependencies.buildReports,
        validateReports: dependencies.validateReports,
        onStage: (next) => { stage = next; dependencies.onStage?.(next); },
      });

      const snapshot = await transaction.scoreSnapshot.create({
        data: {
          assessmentAttemptId: attempt.id,
          scoringPolicyId: attempt.scoringPolicyId,
          scoringPolicyVersion: attempt.scoringPolicyVersion,
          scoringPolicyChecksum: sha256Canonical({
            id: attempt.scoringPolicyId,
            version: attempt.scoringPolicyVersion,
            engineVersion: computed.factSheet.engineVersion,
          }),
          score: computed.factSheet.globalScore,
          result: json(computed.factSheet),
        },
      });
      await transaction.evidenceItem.createMany({
        data: computed.facts.items.map((item) => ({
          scoreSnapshotId: snapshot.id,
          kind: 'ANSWER' as const,
          competencyId: item.nodeCpsId,
          sourceKey: item.itemId,
          payload: json(item),
        })),
      });
      await advanceAttemptLifecycle(transaction, {
        attemptId: attempt.id,
        from: 'SUBMITTED',
        action: 'SCORE',
        actor: 'WORKER',
      });
      const reportBundle = computed.reports satisfies DeterministicBilanReportBundle;
      const pending = await createPendingReport(transaction, {
        attemptId: attempt.id,
        studentId: attempt.studentId,
        scoreSnapshotId: snapshot.id,
        reportPackId: enabled.pack.slug,
        reportPackVersion: String(enabled.pack.version),
        contextChecksum: sha256Canonical(reportBundle),
        content: json(reportBundle),
        validationFailures: [],
      });
      await transaction.jobOutbox.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          attemptCount: { increment: 1 },
          completedAt: dependencies.now(),
          leaseOwner: null,
          leaseExpiresAt: null,
          lastError: null,
        },
      });
      return {
        jobId,
        snapshotId: snapshot.id,
        artifactId: pending.artifact.id,
        revisionId: pending.revision.id,
        replayed: false,
      };
    });
    dependencies.logger.info({ event: 'A86_SCORE_JOB_COMPLETED', jobId, durationMs: Date.now() - started });
    return result;
  } catch (error) {
    const code = error instanceof ScoreJobError ? error.code : failureCode(stage);
    await dependencies.prisma.jobOutbox.updateMany({
      where: { id: jobId, status: { not: 'COMPLETED' } },
      data: {
        status: 'FAILED',
        attemptCount: { increment: 1 },
        lastError: code,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    dependencies.logger.error({ event: 'A86_SCORE_JOB_FAILED', jobId, code, durationMs: Date.now() - started });
    throw new ScoreJobError(code);
  }
}
