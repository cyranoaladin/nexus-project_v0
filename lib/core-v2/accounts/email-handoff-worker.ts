import { appendAuditEvent } from '@/lib/core-v2/audit';
import { accountTokenDigest } from '@/lib/core-v2/account-token';
import { randomUUID } from 'node:crypto';
import type { PrismaClient, CoreV2JobOutbox } from '@/core-v2/generated/client';
import { Prisma, CoreV2JobStatus, CoreV2JobType } from '@/lib/core-v2/client';
import { openAccountEmailHandoff, type AccountEmailHandoffContent } from '@/lib/email/account-handoff-envelope';

const MAX_ATTEMPTS = 20;
const LEASE_MS = 30_000;
export interface AccountEmailHandoffWorkerOptions {
  readonly owner?: string;
  readonly limit?: number;
  readonly now: () => Date;
  /** Resolves only after the idempotent destination outbox transaction commits. */
  readonly transfer: (content: AccountEmailHandoffContent) => Promise<void>;
}

export async function drainAccountEmailHandoffs(database: PrismaClient, options: AccountEmailHandoffWorkerOptions) {
  const owner = options.owner ?? randomUUID();
  const limit = options.limit ?? 20;
  const at = options.now();
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !owner || owner.length > 128 || !Number.isFinite(at.getTime())) {
    throw new Error('ACCOUNT_EMAIL_WORKER_OPTIONS_INVALID');
  }
  const exhausted = await database.coreV2JobOutbox.updateMany({
    where: { jobType: CoreV2JobType.ACCOUNT_EMAIL_HANDOFF, aggregateType: 'ACCOUNT_EMAIL_HANDOFF',
      status: CoreV2JobStatus.LEASED, leaseExpiresAt: { lte: at }, attemptCount: { gte: MAX_ATTEMPTS } },
    data: { status: CoreV2JobStatus.FAILED_FINAL, leaseOwner: null, leaseExpiresAt: null,
      lastError: 'ACCOUNT_EMAIL_ATTEMPTS_EXHAUSTED' },
  });
  const claim = () => database.$transaction(async (tx) => {
    const selected = await tx.$queryRaw<CoreV2JobOutbox[]>(Prisma.sql`
      SELECT * FROM core_v2_job_outbox
      WHERE "jobType" = ${CoreV2JobType.ACCOUNT_EMAIL_HANDOFF}::"CoreV2JobType"
        AND "aggregateType" = 'ACCOUNT_EMAIL_HANDOFF'
        AND "attemptCount" < ${MAX_ATTEMPTS}
        AND ((status IN ('PENDING', 'RETRY_SCHEDULED') AND "availableAt" <= ${options.now()})
          OR (status = 'LEASED' AND "leaseExpiresAt" <= ${options.now()}))
      ORDER BY "availableAt", "createdAt", id
      FOR UPDATE SKIP LOCKED LIMIT 1
    `);
    for (const job of selected) {
      await tx.coreV2JobOutbox.update({ where: { id: job.id }, data: {
        status: CoreV2JobStatus.LEASED, leaseOwner: owner,
        leaseExpiresAt: new Date(options.now().getTime() + LEASE_MS), attemptCount: { increment: 1 },
      } });
    }
    return selected.map((job) => ({ ...job, attemptCount: job.attemptCount + 1 }));
  });
  let completed = 0; let discarded = 0; let retried = 0; let leaseLost = 0; let failedFinal = exhausted.count;
  let claimed = 0;
  for (let index = 0; index < limit; index += 1) {
    const jobs = await claim();
    if (jobs.length === 0) break;
    claimed += jobs.length;
    const job = jobs[0];
    try {
      const content = openAccountEmailHandoff(job.payload, job.aggregateId);
      const disposition = await database.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ status: string; leaseOwner: string | null; leaseExpiresAt: Date | null }>>(Prisma.sql`
          SELECT status::text, "leaseOwner", "leaseExpiresAt" FROM core_v2_job_outbox WHERE id = ${job.id} FOR UPDATE
        `);
        const lease = locked[0];
        const now = options.now();
        if (!lease || lease.status !== CoreV2JobStatus.LEASED || lease.leaseOwner !== owner ||
          !lease.leaseExpiresAt || lease.leaseExpiresAt <= now) return 'LEASE_LOST';
        // Locks cover the cross-database enqueue commit: revocation or recipient
        // mutation cannot overtake an eligible transfer. No provider send here.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${content.userId} FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM invitations WHERE id = ${content.issuanceId} FOR SHARE`;
        const issuance = await tx.invitation.findUnique({ where: { id: content.issuanceId }, include: { user: true } });
        const eligibleAt = options.now();
        if (lease.leaseExpiresAt <= eligibleAt) return 'LEASE_LOST';
        const valid = Boolean(issuance && issuance.userId === content.userId && issuance.purpose === content.purpose &&
          accountTokenDigest(content.rawToken, content.purpose) === issuance.tokenHash &&
          !issuance.consumedAt && !issuance.revokedAt && issuance.expiresAt > eligibleAt &&
          issuance.expiresAt.toISOString() === content.expiresAt && issuance.user.email === content.email &&
          issuance.user.role === content.role && (content.purpose === 'ACTIVATION'
            ? issuance.user.accountStatus === 'PENDING_ACTIVATION' : issuance.user.accountStatus === 'ACTIVE'));
        if (valid) await options.transfer(content);
        if (lease.leaseExpiresAt <= options.now()) throw new Error('ACCOUNT_EMAIL_LEASE_EXPIRED');
        await tx.coreV2JobOutbox.update({ where: { id: job.id }, data: {
          status: CoreV2JobStatus.COMPLETED, completedAt: options.now(), leaseOwner: null,
          leaseExpiresAt: null, lastError: valid ? null : 'ACCOUNT_EMAIL_ISSUANCE_INELIGIBLE',
        } });
        await appendAuditEvent(tx, {
          actorUserId: null,
          action: valid ? 'account.email_handoff_transferred' : 'account.email_handoff_discarded',
          subjectType: 'Invitation', subjectId: content.issuanceId, correlationId: job.id,
          metadata: { jobId: job.id, attemptCount: job.attemptCount },
        });
        return valid ? 'COMPLETED' : 'DISCARDED';
      }, { maxWait: 5_000, timeout: 20_000 });
      if (disposition === 'LEASE_LOST') leaseLost += 1;
      else if (disposition === 'COMPLETED') completed += 1;
      else discarded += 1;
    } catch {
      const terminal = job.attemptCount >= MAX_ATTEMPTS;
      const result = await database.coreV2JobOutbox.updateMany({
        where: { id: job.id, status: CoreV2JobStatus.LEASED, leaseOwner: owner, leaseExpiresAt: { gt: options.now() } },
        data: { status: terminal ? CoreV2JobStatus.FAILED_FINAL : CoreV2JobStatus.RETRY_SCHEDULED,
          availableAt: new Date(options.now().getTime() + Math.min(5_000 * 2 ** Math.min(job.attemptCount - 1, 6), 300_000)),
          leaseOwner: null, leaseExpiresAt: null, lastError: 'ACCOUNT_EMAIL_TRANSFER_FAILED' },
      });
      if (!result.count) leaseLost += 1;
      else if (terminal) failedFinal += 1;
      else retried += 1;
    }
  }
  return Object.freeze({ claimed, completed, discarded, retried, leaseLost, failedFinal });
}
