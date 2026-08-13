import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { resolveEnabledPack, type PackResolver } from '../api/pack-access';
import { advanceAttemptLifecycle } from '../core/report-service';
import { sha256Canonical } from '../local-first/hash';
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

/**
 * Scores a submitted attempt and hands off report generation to a separate
 * GENERATE_REPORT job, rather than creating the report inline. Report
 * generation (LLM, network-bound, can take up to a minute) must never share
 * a transaction with scoring — and `canonical_report_revisions` is
 * append-only, so its content must be right the first time, computed before
 * the one INSERT that creates it. Splitting the jobs is what makes both of
 * those true at once.
 */
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
        if (snapshot === null) throw new ScoreJobError('A86_COMPLETED_JOB_INCONSISTENT');
        const generateReportJob = await transaction.jobOutbox.findUnique({
          where: { idempotencyKey: `${job.aggregateId}.generate-report` },
        });
        if (generateReportJob === null) throw new ScoreJobError('A86_COMPLETED_JOB_INCONSISTENT');
        return { jobId, snapshotId: snapshot.id, generateReportJobId: generateReportJob.id, replayed: true };
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
      // buildReports/validateReports still run here as a structural sanity
      // check on the FactSheet (proves it renders), even though their output
      // is no longer persisted -- GENERATE_REPORT computes the content that
      // actually gets stored.
      const computed = buildWorkerScoring({
        attemptId: attempt.id,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        answers: attempt.answers,
        pack: enabled.pack,
      }, {
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
      const generateReportJob = await transaction.jobOutbox.create({
        data: {
          jobType: 'GENERATE_REPORT',
          aggregateType: 'CanonicalAssessmentAttempt',
          aggregateId: attempt.id,
          sourceEventKey: `${attempt.id}.scored`,
          idempotencyKey: `${attempt.id}.generate-report`,
          payload: {
            attemptId: attempt.id,
            scoreSnapshotId: snapshot.id,
          },
        },
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
        generateReportJobId: generateReportJob.id,
        replayed: false,
      };
    });
    dependencies.logger.info({ event: 'A86_SCORE_JOB_COMPLETED', jobId, durationMs: Date.now() - started });
    return result;
  } catch (error) {
    const code = error instanceof ScoreJobError ? error.code : failureCode(stage);
    // Préserver la CAUSE RÉELLE. Une erreur non typée (ex. `A86_ANSWER_MISSING`
    // levée par buildInputs) était sinon remplacée par le code générique de
    // stage (`A86_WORKER_FAILED`) : 834 tentatives opaques, cause indéchiffrable
    // (incident du 13/08/2026). On conserve désormais le message d'origine dans
    // lastError et dans les logs, sans jamais l'écraser.
    const cause = error instanceof Error ? error.message : String(error);
    const lastError = cause && cause !== code ? `${code}: ${cause}` : code;
    await dependencies.prisma.jobOutbox.updateMany({
      where: { id: jobId, status: { not: 'COMPLETED' } },
      data: {
        status: 'FAILED',
        attemptCount: { increment: 1 },
        lastError,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    dependencies.logger.error({ event: 'A86_SCORE_JOB_FAILED', jobId, code, cause, durationMs: Date.now() - started });
    throw new ScoreJobError(code);
  }
}
