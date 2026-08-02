import { randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { processScoreAttemptJob } from './score-job';

type DrainDatabase = Pick<PrismaClient, '$transaction'>;
type DrainLogger = Readonly<{
  info(event: Readonly<Record<string, unknown>>): void;
  error(event: Readonly<Record<string, unknown>>): void;
}>;

type DrainDependencies = Readonly<{
  prisma: DrainDatabase;
  processJob(jobId: string): Promise<unknown>;
  now: () => Date;
  logger: DrainLogger;
}>;

export type DrainScoreAttemptJobsOptions = Readonly<{
  limit?: number;
  owner?: string;
  leaseDurationMs?: number;
}>;

const defaultDependencies: DrainDependencies = {
  prisma,
  processJob: processScoreAttemptJob,
  now: () => new Date(),
  logger: {
    info: (event) => console.info(JSON.stringify(event)),
    error: (event) => console.error(JSON.stringify(event)),
  },
};

function boundedLimit(value: number | undefined): number {
  const limit = value ?? 10;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('A87_DRAIN_LIMIT_INVALID');
  }
  return limit;
}

function leaseDuration(value: number | undefined): number {
  const duration = value ?? 5 * 60_000;
  if (!Number.isSafeInteger(duration) || duration < 1_000 || duration > 30 * 60_000) {
    throw new Error('A87_DRAIN_LEASE_INVALID');
  }
  return duration;
}

async function claimJobs(
  database: DrainDatabase,
  input: Readonly<{ limit: number; owner: string; now: Date; leaseExpiresAt: Date }>,
): Promise<readonly string[]> {
  return database.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "canonical_job_outbox"
      WHERE "jobType" = 'SCORE_ATTEMPT'::"CanonicalJobType"
        AND "availableAt" <= ${input.now}
        AND (
          "status" IN ('PENDING'::"CanonicalOutboxStatus", 'FAILED'::"CanonicalOutboxStatus")
          OR (
            "status" = 'LEASED'::"CanonicalOutboxStatus"
            AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${input.now})
          )
        )
      ORDER BY "availableAt" ASC, "createdAt" ASC, "id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${input.limit}
    `);

    for (const row of rows) {
      await transaction.jobOutbox.update({
        where: { id: row.id },
        data: {
          status: 'LEASED',
          leaseOwner: input.owner,
          leaseExpiresAt: input.leaseExpiresAt,
        },
      });
    }
    return Object.freeze(rows.map(({ id }) => id));
  });
}

export async function drainScoreAttemptJobs(
  options: DrainScoreAttemptJobsOptions = {},
  dependencies: Partial<DrainDependencies> = {},
) {
  const deps: DrainDependencies = { ...defaultDependencies, ...dependencies };
  const limit = boundedLimit(options.limit);
  const duration = leaseDuration(options.leaseDurationMs);
  const owner = options.owner?.trim() || `a87-manual-${process.pid}-${randomUUID()}`;
  const now = deps.now();
  const startedAt = Date.now();
  const jobIds = await claimJobs(deps.prisma, {
    limit,
    owner,
    now,
    leaseExpiresAt: new Date(now.getTime() + duration),
  });

  let completed = 0;
  let failed = 0;
  for (const jobId of jobIds) {
    try {
      await deps.processJob(jobId);
      completed += 1;
    } catch {
      failed += 1;
      deps.logger.error({ event: 'A87_DRAIN_JOB_FAILED', jobId });
    }
  }

  const result = Object.freeze({ claimed: jobIds.length, completed, failed });
  deps.logger.info({ event: 'A87_DRAIN_COMPLETED', ...result, durationMs: Date.now() - startedAt });
  return result;
}
