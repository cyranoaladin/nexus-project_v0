import { randomUUID } from 'node:crypto';

import { Prisma, UserRole, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { processScoreAttemptJob } from './score-job';
import { processGenerateReportJob } from './generate-report-job';
import { processGenerateTeacherBriefJob } from './generate-teacher-brief-job';

type DrainDatabase = Pick<PrismaClient, '$transaction' | '$queryRaw' | 'user' | 'notification'>;
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

const defaultLogger: DrainLogger = {
  info: (event) => console.info(JSON.stringify(event)),
  error: (event) => console.error(JSON.stringify(event)),
};

const defaultScoreDependencies: DrainDependencies = {
  prisma,
  processJob: processScoreAttemptJob,
  now: () => new Date(),
  logger: defaultLogger,
};

const defaultGenerateReportDependencies: DrainDependencies = {
  prisma,
  processJob: processGenerateReportJob,
  now: () => new Date(),
  logger: defaultLogger,
};

function boundedLimit(value: number | undefined): number {
  const limit = value ?? 10;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('A87_DRAIN_LIMIT_INVALID');
  }
  return limit;
}

/**
 * Plafond de tentatives : au-delà, un job en échec DÉTERMINISTE (pack
 * indisponible, réponses malformées…) n'est plus réclamé — sinon il boucle à
 * l'infini et occupe un créneau de worker à chaque cycle (incident du
 * 13/08/2026 : un job SCORE en échec 806 fois). Le job reste en base
 * (diagnostic possible) mais sort de la file active : c'est une quarantaine,
 * pas une suppression. Chaque cycle journalise les jobs ainsi mis de côté
 * pour qu'ils restent visibles.
 */
export const MAX_JOB_ATTEMPTS = 20;

function leaseDuration(value: number | undefined): number {
  const duration = value ?? 5 * 60_000;
  if (!Number.isSafeInteger(duration) || duration < 1_000 || duration > 30 * 60_000) {
    throw new Error('A87_DRAIN_LEASE_INVALID');
  }
  return duration;
}

async function claimJobs(
  database: DrainDatabase,
  jobType: 'SCORE_ATTEMPT' | 'GENERATE_REPORT' | 'GENERATE_TEACHER_BRIEF',
  input: Readonly<{ limit: number; owner: string; now: Date; leaseExpiresAt: Date }>,
): Promise<readonly string[]> {
  return database.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "canonical_job_outbox"
      WHERE "jobType" = ${jobType}::"CanonicalJobType"
        AND "availableAt" <= ${input.now}
        AND "attemptCount" < ${MAX_JOB_ATTEMPTS}
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

const QUARANTINE_NOTIFICATION_TYPE = 'SCORING_JOB_QUARANTINED';

/**
 * Crée une notification pour l'équipe assistante quand des jobs sont en
 * quarantaine — dédupliquée : au plus UNE notification non lue par type de
 * job à la fois, pour ne pas spammer à chaque cycle de drain. Elle reste
 * jusqu'à lecture ; sa présence dit « des passations ne se scorent pas ».
 */
async function ensureQuarantineAlert(
  database: DrainDatabase,
  jobType: string,
  count: number,
): Promise<void> {
  const already = await database.notification.findFirst({
    where: { type: QUARANTINE_NOTIFICATION_TYPE, read: false, message: { contains: jobType } },
    select: { id: true },
  });
  if (already !== null) return;
  const assistants = await database.user.findMany({ where: { role: UserRole.ASSISTANTE }, select: { id: true } });
  if (assistants.length === 0) return;
  const rows: Prisma.NotificationCreateManyInput[] = assistants.map(({ id }) => ({
    userId: id,
    userRole: UserRole.ASSISTANTE,
    type: QUARANTINE_NOTIFICATION_TYPE,
    title: 'Scoring impossible — élève sans bilan',
    message: `${count} passation(s) (${jobType}) ne se scorent pas après ${MAX_JOB_ATTEMPTS} tentatives. Ouvrez « Bilans » pour les reprendre.`,
    data: { jobType, count, maxAttempts: MAX_JOB_ATTEMPTS },
  }));
  await database.notification.createMany({ data: rows });
}

async function drainJobs(
  jobType: 'SCORE_ATTEMPT' | 'GENERATE_REPORT' | 'GENERATE_TEACHER_BRIEF',
  ownerPrefix: string,
  eventPrefix: string,
  defaults: DrainDependencies,
  options: DrainScoreAttemptJobsOptions,
  dependencies: Partial<DrainDependencies>,
) {
  const deps: DrainDependencies = { ...defaults, ...dependencies };
  const limit = boundedLimit(options.limit);
  const duration = leaseDuration(options.leaseDurationMs);
  const owner = options.owner?.trim() || `${ownerPrefix}-${process.pid}-${randomUUID()}`;
  const now = deps.now();
  const startedAt = Date.now();
  const jobIds = await claimJobs(deps.prisma, jobType, {
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
      deps.logger.error({ event: `${eventPrefix}_DRAIN_JOB_FAILED`, jobId });
    }
  }

  // Visibilité : les jobs mis en quarantaine (plafond de tentatives atteint)
  // ne sont plus réclamés mais restent en base. On les compte à chaque cycle
  // pour qu'ils ne disparaissent pas silencieusement de la supervision.
  const quarantined = await deps.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT count(*)::bigint AS count
    FROM "canonical_job_outbox"
    WHERE "jobType" = ${jobType}::"CanonicalJobType"
      AND "attemptCount" >= ${MAX_JOB_ATTEMPTS}
  `);
  const quarantinedCount = Number(quarantined[0]?.count ?? BigInt(0));
  if (quarantinedCount > 0) {
    deps.logger.error({ event: `${eventPrefix}_JOBS_QUARANTINED`, jobType, count: quarantinedCount, maxAttempts: MAX_JOB_ATTEMPTS });
    // Alerte l'équipe — pas seulement le journal : un job en quarantaine
    // signifie un élève potentiellement sans bilan. Déduplication : une seule
    // notification non lue par type de job, pour ne pas spammer à chaque cycle.
    await ensureQuarantineAlert(deps.prisma, jobType, quarantinedCount);
  }

  const result = Object.freeze({ claimed: jobIds.length, completed, failed, quarantined: quarantinedCount });
  deps.logger.info({ event: `${eventPrefix}_DRAIN_COMPLETED`, ...result, durationMs: Date.now() - startedAt });
  return result;
}

export async function drainScoreAttemptJobs(
  options: DrainScoreAttemptJobsOptions = {},
  dependencies: Partial<DrainDependencies> = {},
) {
  return drainJobs('SCORE_ATTEMPT', 'a87-manual', 'A87', defaultScoreDependencies, options, dependencies);
}

export async function drainGenerateReportJobs(
  options: DrainScoreAttemptJobsOptions = {},
  dependencies: Partial<DrainDependencies> = {},
) {
  return drainJobs('GENERATE_REPORT', 'a88-manual', 'A88', defaultGenerateReportDependencies, options, dependencies);
}

const defaultGenerateTeacherBriefDependencies: DrainDependencies = {
  prisma,
  processJob: processGenerateTeacherBriefJob,
  now: () => new Date(),
  logger: defaultLogger,
};

/**
 * Concurrence volontairement limitée à 1 génération de brief à la fois
 * (§10 de l'incident P0, tant qu'aucune preuve de charge/budget ne justifie
 * plus) : `limit: 1` par défaut, distinct du défaut ×10 des autres files.
 */
export async function drainTeacherBriefJobs(
  options: DrainScoreAttemptJobsOptions = {},
  dependencies: Partial<DrainDependencies> = {},
) {
  return drainJobs('GENERATE_TEACHER_BRIEF', 'a90-manual', 'A90', defaultGenerateTeacherBriefDependencies, { limit: 1, ...options }, dependencies);
}
