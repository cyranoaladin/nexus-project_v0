import { createHash, randomUUID } from 'node:crypto';

import { Prisma, type JobOutbox, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email/mailer';
import { decryptEmailIntent } from '@/lib/email/outbox';

type WorkerDatabase = Pick<PrismaClient, '$transaction' | 'jobOutbox'>;
type DeliveryStatus = 'AMBIGUOUS' | 'RETRY_SCHEDULED' | 'FAILED_FINAL';

export type EmailOutboxWorkerDependencies = Readonly<{
  prisma: WorkerDatabase;
  deliver: typeof sendMail;
  now: () => Date;
  logger: Readonly<{
    info(event: Readonly<Record<string, unknown>>): void;
    error(event: Readonly<Record<string, unknown>>): void;
  }>;
}>;

const defaults: EmailOutboxWorkerDependencies = {
  prisma,
  deliver: sendMail,
  now: () => new Date(),
  logger: {
    info: (event) => console.info(JSON.stringify(event)),
    error: (event) => console.error(JSON.stringify(event)),
  },
};

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error('EMAIL_OUTBOX_POLICY_INVALID');
  return parsed;
}

function maxAttempts(): number {
  return boundedInteger(process.env.EMAIL_OUTBOX_MAX_ATTEMPTS, 6, 1, 20);
}

function retryDelayMs(jobId: string, attempt: number, ambiguous: boolean): number {
  const base = ambiguous ? 5 * 60_000 : Math.min(60 * 60_000, 5_000 * (2 ** Math.max(0, attempt - 1)));
  const jitter = createHash('sha256').update(`${jobId}:${attempt}`).digest().readUInt16BE(0) % 1_001;
  return base + jitter;
}

function failureMetadata(error: unknown): Readonly<{
  code: string;
  responseCode?: number;
  command?: string;
}> {
  if (!error || typeof error !== 'object') return { code: 'SMTP_SEND_FAILED' };
  const record = error as Record<string, unknown>;
  const responseCode = Number(record.responseCode);
  return {
    code: typeof record.code === 'string' ? record.code : 'SMTP_SEND_FAILED',
    responseCode: Number.isInteger(responseCode) ? responseCode : undefined,
    command: typeof record.command === 'string' ? record.command.toUpperCase() : undefined,
  };
}

export function classifySmtpFailure(error: unknown, nextAttempt: number): Readonly<{
  status: DeliveryStatus;
  code: string;
}> {
  const failure = failureMetadata(error);
  if (nextAttempt >= maxAttempts() || (failure.responseCode !== undefined && failure.responseCode >= 500)) {
    return { status: 'FAILED_FINAL', code: failure.code };
  }
  const ambiguous = failure.command === 'DATA'
    || ['ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'EPIPE'].includes(failure.code);
  return { status: ambiguous ? 'AMBIGUOUS' : 'RETRY_SCHEDULED', code: failure.code };
}

async function claim(
  database: WorkerDatabase,
  input: Readonly<{ limit: number; owner: string; now: Date; leaseExpiresAt: Date }>,
): Promise<readonly JobOutbox[]> {
  return database.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<JobOutbox[]>(Prisma.sql`
      SELECT *
      FROM "canonical_job_outbox"
      WHERE "jobType" = 'SEND_EMAIL'::"CanonicalJobType"
        AND "availableAt" <= ${input.now}
        AND (
          "status" IN (
            'PENDING'::"CanonicalOutboxStatus",
            'RETRY_SCHEDULED'::"CanonicalOutboxStatus",
            'AMBIGUOUS'::"CanonicalOutboxStatus"
          )
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
    return Object.freeze(rows);
  });
}

export async function drainEmailOutbox(
  options: Readonly<{ limit?: number; owner?: string; leaseDurationMs?: number }> = {},
  dependencies: Partial<EmailOutboxWorkerDependencies> = {},
) {
  const deps = { ...defaults, ...dependencies };
  const limit = boundedInteger(options.limit?.toString(), 20, 1, 100);
  const leaseDurationMs = boundedInteger(options.leaseDurationMs?.toString(), 60_000, 5_000, 30 * 60_000);
  const owner = options.owner?.trim() || `email-${process.pid}-${randomUUID()}`;
  const now = deps.now();
  const jobs = await claim(deps.prisma, {
    limit,
    owner,
    now,
    leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
  });
  let completed = 0;
  let retried = 0;
  let finalFailed = 0;

  for (const job of jobs) {
    try {
      const intent = decryptEmailIntent(job.payload);
      const delivered = await deps.deliver(intent.content);
      if (!delivered.ok || delivered.skipped) throw Object.assign(new Error('SMTP_NOT_DELIVERED'), { code: 'SMTP_NOT_DELIVERED' });
      const updated = await deps.prisma.jobOutbox.updateMany({
        where: { id: job.id, status: 'LEASED', leaseOwner: owner },
        data: {
          status: 'COMPLETED',
          attemptCount: { increment: 1 },
          completedAt: deps.now(),
          leaseOwner: null,
          leaseExpiresAt: null,
          lastError: null,
        },
      });
      if (updated.count !== 1) throw new Error('EMAIL_OUTBOX_LEASE_LOST');
      completed += 1;
      deps.logger.info({ event: 'EMAIL_OUTBOX_COMPLETED', jobId: job.id, attempt: job.attemptCount + 1 });
    } catch (error) {
      const nextAttempt = job.attemptCount + 1;
      const failure = classifySmtpFailure(error, nextAttempt);
      const availableAt = failure.status === 'FAILED_FINAL'
        ? deps.now()
        : new Date(deps.now().getTime() + retryDelayMs(job.id, nextAttempt, failure.status === 'AMBIGUOUS'));
      const updated = await deps.prisma.jobOutbox.updateMany({
        where: { id: job.id, status: 'LEASED', leaseOwner: owner },
        data: {
          status: failure.status,
          attemptCount: { increment: 1 },
          availableAt,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastError: failure.code,
        },
      });
      if (updated.count === 1) {
        if (failure.status === 'FAILED_FINAL') finalFailed += 1;
        else retried += 1;
      }
      deps.logger.error({
        event: 'EMAIL_OUTBOX_DELIVERY_FAILED',
        jobId: job.id,
        attempt: nextAttempt,
        status: failure.status,
        code: failure.code,
      });
    }
  }
  return Object.freeze({ claimed: jobs.length, completed, retried, finalFailed });
}

function completedRetentionDays(): number {
  return boundedInteger(process.env.EMAIL_OUTBOX_COMPLETED_RETENTION_DAYS, 30, 1, 365);
}

function ambiguousAlertAgeMs(): number {
  return boundedInteger(process.env.EMAIL_OUTBOX_AMBIGUOUS_ALERT_AGE_MS, 15 * 60_000, 60_000, 24 * 60 * 60_000);
}

export async function maintainEmailOutbox(
  options: Readonly<{ limit?: number; now?: Date }> = {},
  database: WorkerDatabase = prisma,
) {
  const limit = boundedInteger(options.limit?.toString(), 100, 1, 100);
  const now = options.now ?? new Date();
  const completedBefore = new Date(now.getTime() - completedRetentionDays() * 24 * 60 * 60_000);
  const ambiguousBefore = new Date(now.getTime() - ambiguousAlertAgeMs());
  const [completed, failedFinal, oldAmbiguous] = await Promise.all([
    database.jobOutbox.findMany({
      where: { jobType: 'SEND_EMAIL', status: 'COMPLETED', completedAt: { lt: completedBefore } },
      orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
      take: limit,
    }),
    database.jobOutbox.count({ where: { jobType: 'SEND_EMAIL', status: 'FAILED_FINAL' } }),
    database.jobOutbox.count({
      where: { jobType: 'SEND_EMAIL', status: 'AMBIGUOUS', updatedAt: { lt: ambiguousBefore } },
    }),
  ]);
  const deleted = completed.length === 0
    ? 0
    : (await database.jobOutbox.deleteMany({
      where: { id: { in: completed.map((job) => job.id) }, status: 'COMPLETED' },
    })).count;
  return Object.freeze({ deleted, failedFinal, oldAmbiguous });
}
