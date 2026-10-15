import { createHash, randomUUID } from 'node:crypto';

import { Prisma, type JobOutbox, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email/mailer';
import { decryptEmailIntent } from '@/lib/email/outbox';
import { assertV1InvitationIdentity, V1InvitationScopeRefusal } from '@/lib/auth/v1-invitation-authority';
import { revokeV1AccountInvitation } from '@/lib/auth/v1-account-invitation';
import { InvitationDeliveryRefusal, resolveAccountInvitationAuthority, type AccountInvitationAuthority,
  type AccountInvitationDeliveryAuthority } from './account-invitation-authority';

type WorkerDatabase = Pick<PrismaClient, '$transaction' | 'jobOutbox'>;
type DeliveryStatus = 'AMBIGUOUS' | 'RETRY_SCHEDULED' | 'FAILED_FINAL';

export type EmailOutboxWorkerDependencies = Readonly<{
  prisma: WorkerDatabase;
  deliver: typeof sendMail;
  accountInvitationAuthority?: AccountInvitationAuthority;
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

/** A successful SMTP handoff cannot be rolled back with its DB transaction. */
export function classifyInvitationSmtpFailure(error: unknown, nextAttempt: number): ReturnType<typeof classifySmtpFailure> {
  const failure = failureMetadata(error);
  const beforeData = failure.command !== undefined && [
    'CONN', 'EHLO', 'HELO', 'STARTTLS', 'AUTH', 'MAIL FROM', 'RCPT TO',
  ].includes(failure.command);
  // Only an explicit protocol rejection before DATA proves that the recipient
  // did not receive the message. Unknown errors and lost acknowledgements stay
  // quarantined, even at the retry limit; no guessed automatic redelivery.
  if (beforeData && failure.responseCode !== undefined) return classifySmtpFailure(error, nextAttempt);
  return { status: 'AMBIGUOUS', code: 'INVITATION_DELIVERY_UNCERTAIN' };
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
      AND NOT ("aggregateType" = 'account-invitation' AND "status" = 'AMBIGUOUS'::"CanonicalOutboxStatus")
      ORDER BY "availableAt" ASC, "createdAt" ASC, "id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${input.limit}
    `);
    for (const row of rows) {
      await transaction.jobOutbox.update({
        where: { id: row.id },
        data: {
          // Commit uncertainty before any external handoff. If this process is
          // killed after SMTP 250, the rolled-back acknowledgement leaves this
          // durable marker, which claim deliberately never reclaims.
          status: row.aggregateType === 'account-invitation' ? 'AMBIGUOUS' : 'LEASED',
          ...(row.aggregateType === 'account-invitation' ? { lastError: 'INVITATION_DELIVERY_IN_FLIGHT' } : {}),
          leaseOwner: input.owner,
          attemptCount: { increment: 1 },
          leaseExpiresAt: input.leaseExpiresAt,
        },
      });
    }
    return Object.freeze(rows.map(row => ({ ...row, status: row.aggregateType === 'account-invitation' ? 'AMBIGUOUS' as const : 'LEASED' as const,
      leaseOwner: input.owner, leaseExpiresAt: input.leaseExpiresAt, attemptCount: row.attemptCount + 1 })));
  });
}

export async function drainEmailOutbox(
  options: Readonly<{ limit?: number; owner?: string; leaseDurationMs?: number }> = {},
  dependencies: Partial<EmailOutboxWorkerDependencies> = {},
) {
  const deps = { ...defaults, ...dependencies };
  const limit = boundedInteger(options.limit?.toString(), 20, 1, 100);
  const leaseDurationMs = boundedInteger(options.leaseDurationMs?.toString(), 60_000, 5_000, 30 * 60_000);
  // A process label is never the fencing token: allocate a fresh UUID per claim.
  if (options.owner && options.owner.length > 128) throw new Error('EMAIL_OUTBOX_POLICY_INVALID');
  let claimed = 0; let completed = 0; let retried = 0; let finalFailed = 0;
  for (let index = 0; index < limit; index += 1) {
    const now = deps.now();
    const jobs = await claim(deps.prisma, { limit: 1, owner: randomUUID(), now,
      leaseExpiresAt: new Date(now.getTime() + leaseDurationMs) });
    const job = jobs[0];
    if (!job) break;
    claimed += 1;
    const owned = () => ({ id: job.id, status: job.status, leaseOwner: job.leaseOwner,
      leaseExpiresAt: { gt: deps.now() } });
    const match = /^(.+):g([1-9][0-9]{0,8})$/.exec(job.aggregateId);
    const reference = job.aggregateType === 'account-invitation' && match
      ? { userId: match[1], generation: Number(match[2]) } : null;
    let smtpStarted = false;
    try {
      if (job.aggregateType === 'account-invitation' && !reference) throw new InvitationDeliveryRefusal();
      const deliver = (authority?: AccountInvitationDeliveryAuthority) => deps.prisma.$transaction(async tx => {
        const intent = decryptEmailIntent(job.payload);
        if (authority) {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`core-invitation:${authority.userId}`}::text, 1026))::text`;
          const receipt = await tx.v1AccountInvitationIssuance.findUnique({ where: { userId_generation:
            { userId: authority.userId, generation: authority.generation } } });
          const digest = createHash('sha256').update(intent.content.to.trim().toLowerCase()).digest('hex');
          if (!receipt || receipt.revokedAt || receipt.deliveredAt || receipt.outboxId !== job.id
            || receipt.outcome !== 'INVITED' || !receipt.expiresAt || receipt.expiresAt <= deps.now()
            || receipt.issuerId !== authority.issuerId || receipt.issuerVersion !== authority.issuerVersion
            || receipt.bindingDigest !== authority.bindingDigest || receipt.databaseIdentity !== authority.databaseIdentity
            || receipt.operation !== authority.operation || receipt.recipientDigest !== authority.recipientDigest
            || digest !== authority.recipientDigest) throw new InvitationDeliveryRefusal();
          try {
            await assertV1InvitationIdentity(tx, { issuerId: authority.issuerId, expectedIssuerVersion: authority.issuerVersion,
              targetId: authority.userId, recipient: intent.content.to, targetRole: receipt.targetRole });
          } catch (error) {
            if (error instanceof V1InvitationScopeRefusal) throw new InvitationDeliveryRefusal();
            throw error;
          }
          const target = await tx.user.findUnique({ where: { id: authority.userId }, select: {
            password: true, activatedAt: true, activationToken: true, activationExpiry: true } });
          if (!target || target.password !== null || target.activatedAt !== null
            || target.activationToken !== receipt.activationTokenHash
            || target.activationExpiry?.getTime() !== receipt.expiresAt.getTime()) throw new InvitationDeliveryRefusal();
        }
        await tx.$queryRaw`SELECT id FROM public.canonical_job_outbox WHERE id = ${job.id} FOR UPDATE`;
        if (!(await tx.jobOutbox.findFirst({ where: owned(), select: { id: true } }))) throw new Error('EMAIL_OUTBOX_LEASE_LOST');
        const remaining = job.leaseExpiresAt!.getTime() - deps.now().getTime();
        if (remaining <= 500) throw new Error('EMAIL_OUTBOX_LEASE_LOST');
        const deadlineAt = new Date(Date.now() + Math.min(2_500, remaining - 250));
        smtpStarted = true;
        const delivered = await deps.deliver(intent.content, { deadlineAt });
        if (!delivered.ok || delivered.skipped) throw Object.assign(new Error('SMTP_NOT_DELIVERED'), { code: 'SMTP_NOT_DELIVERED' });
        const updated = await tx.jobOutbox.updateMany({ where: owned(), data: {
          status: 'COMPLETED', completedAt: deps.now(), leaseOwner: null, leaseExpiresAt: null, lastError: null } });
        if (updated.count !== 1) throw Object.assign(new Error('EMAIL_OUTBOX_LEASE_LOST'), { code: 'ECONNECTION', command: 'DATA' });
        if (authority) await tx.v1AccountInvitationIssuance.update({ where: { userId_generation:
          { userId: authority.userId, generation: authority.generation } }, data: { deliveredAt: deps.now() } });
      });
      if (reference) await (deps.accountInvitationAuthority ?? resolveAccountInvitationAuthority())(reference, deliver);
      else await deliver();
      completed += 1;
      deps.logger.info({ event: 'EMAIL_OUTBOX_COMPLETED', jobId: job.id, attempt: job.attemptCount });
    } catch (error) {
      if (error instanceof InvitationDeliveryRefusal) {
        if (reference) await revokeV1AccountInvitation({ coreUserId: reference.userId, generation: reference.generation });
        await deps.prisma.jobOutbox.updateMany({ where: owned(), data: { status: 'CANCELLED', leaseOwner: null,
          leaseExpiresAt: null, lastError: 'INVITATION_DELIVERY_REFUSED' } });
        deps.logger.info({ event: 'EMAIL_OUTBOX_INVITATION_CANCELLED', jobId: job.id });
        continue;
      }
      const failure = reference && smtpStarted ? classifyInvitationSmtpFailure(error, job.attemptCount)
        : classifySmtpFailure(error, job.attemptCount);
      const availableAt = failure.status === 'FAILED_FINAL' ? deps.now()
        : new Date(deps.now().getTime() + retryDelayMs(job.id, job.attemptCount, failure.status === 'AMBIGUOUS'));
      const updated = await deps.prisma.jobOutbox.updateMany({ where: owned(), data: {
        status: failure.status, availableAt, leaseOwner: null, leaseExpiresAt: null, lastError: failure.code } });
      if (updated.count === 1) {
        if (failure.status === 'FAILED_FINAL') finalFailed += 1; else retried += 1;
      }
      deps.logger.error({ event: 'EMAIL_OUTBOX_DELIVERY_FAILED', jobId: job.id, attempt: job.attemptCount,
        status: failure.status, code: failure.code });
    }
  }
  return Object.freeze({ claimed, completed, retried, finalFailed });
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
