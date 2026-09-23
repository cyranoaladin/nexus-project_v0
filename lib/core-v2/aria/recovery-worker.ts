import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  CoreV2JobStatus,
  CoreV2JobType,
  Prisma,
} from '@/lib/core-v2/client';
import type { PrismaClient } from '@/core-v2/generated/client';
import type { AriaTurnStatus } from '@/lib/aria/domain/conversation/turn-state';

export const MAX_RECOVERY_ATTEMPTS = 20;
export const CORE_V2_ARIA_JOB_LEASE_MS = 30_000;
export const CORE_V2_ARIA_RECOVERY_BACKOFF_CAP_MS = 40_000;

const payloadSchema = z.object({ schemaVersion: z.literal(1), turnId: z.string().min(1) }).strict();
const REDACTED_FAILURE_CODES = new Set(['RECOVERY_PAYLOAD_INVALID', 'RECOVERY_JOB_IDENTITY_MISMATCH', 'RECOVERY_OPERATION_FAILED']);

export interface CoreV2RecoveryJob {
  readonly id: string;
  readonly jobType: CoreV2JobType;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly idempotencyKey: string;
  readonly payload: Prisma.JsonValue;
  readonly status: CoreV2JobStatus;
  readonly availableAt: Date;
  readonly leaseOwner: string | null;
  readonly leaseExpiresAt: Date | null;
  readonly attemptCount: number;
}

export type CoreV2RecoveryDisposition = 'RECOVERED' | 'RESCHEDULED' | 'ALREADY_TERMINAL' | 'LEASE_LOST';

export function recoveryBackoffMs(attemptCount: number): number {
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 1) throw new Error('CORE_V2_RECOVERY_ATTEMPT_INVALID');
  return Math.min(5_000 * (2 ** Math.min(attemptCount - 1, 3)), CORE_V2_ARIA_RECOVERY_BACKOFF_CAP_MS);
}

function safeFailureCode(error: unknown): string {
  if (error instanceof z.ZodError) return 'RECOVERY_PAYLOAD_INVALID';
  if (error instanceof Error && REDACTED_FAILURE_CODES.has(error.message)) return error.message;
  return 'RECOVERY_OPERATION_FAILED';
}

export async function claimCoreV2AriaRecoveryJobs(
  database: Pick<PrismaClient, '$transaction'>,
  input: Readonly<{ limit: number; owner: string; now: Date; leaseExpiresAt: Date }>,
): Promise<readonly CoreV2RecoveryJob[]> {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) throw new Error('CORE_V2_RECOVERY_LIMIT_INVALID');
  return database.$transaction(async (tx) => {
    const jobs = await tx.$queryRaw<CoreV2RecoveryJob[]>(Prisma.sql`
      SELECT * FROM core_v2_job_outbox
      WHERE "jobType" = ${CoreV2JobType.RECOVER_ARIA_TURN}::"CoreV2JobType"
        AND "aggregateType" = 'AriaConversationTurnCoreV2'
        AND "attemptCount" < ${MAX_RECOVERY_ATTEMPTS}
        AND (
          ("status" IN (${CoreV2JobStatus.PENDING}::"CoreV2JobStatus", ${CoreV2JobStatus.RETRY_SCHEDULED}::"CoreV2JobStatus") AND "availableAt" <= ${input.now})
          OR ("status" = ${CoreV2JobStatus.LEASED}::"CoreV2JobStatus" AND "leaseExpiresAt" <= ${input.now})
        )
      ORDER BY "availableAt" ASC, "createdAt" ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${input.limit}
    `);
    for (const job of jobs) {
      await tx.coreV2JobOutbox.update({
        where: { id: job.id },
        data: {
          status: CoreV2JobStatus.LEASED,
          leaseOwner: input.owner,
          leaseExpiresAt: input.leaseExpiresAt,
          attemptCount: { increment: 1 },
        },
      });
    }
    return jobs.map((job) => ({ ...job, status: CoreV2JobStatus.LEASED, leaseOwner: input.owner, leaseExpiresAt: input.leaseExpiresAt, attemptCount: job.attemptCount + 1 }));
  });
}

async function recoverClaimedJob(
  database: Pick<PrismaClient, '$transaction'>,
  job: CoreV2RecoveryJob,
  owner: string,
  now: Date,
): Promise<CoreV2RecoveryDisposition> {
  const payload = payloadSchema.parse(job.payload);
  if (payload.turnId !== job.aggregateId) throw new Error('RECOVERY_JOB_IDENTITY_MISMATCH');
  return database.$transaction(async (tx) => {
    const turns = await tx.$queryRaw<Array<{ id: string; status: AriaTurnStatus; leaseExpiresAt: Date | null; cancellationRequestedAt: Date | null; executionMetadata: Prisma.JsonValue | null }>>(Prisma.sql`
      SELECT id, status::text, "leaseExpiresAt", "cancellationRequestedAt", "executionMetadata"
      FROM aria_conversation_turns_core_v2 WHERE id = ${payload.turnId} FOR UPDATE
    `);
    const jobs = await tx.$queryRaw<Array<{ id: string; status: CoreV2JobStatus; leaseOwner: string | null }>>(Prisma.sql`
      SELECT id, status::text, "leaseOwner" FROM core_v2_job_outbox WHERE id = ${job.id} FOR UPDATE
    `);
    const lockedJob = jobs[0];
    if (!lockedJob || lockedJob.status !== CoreV2JobStatus.LEASED || lockedJob.leaseOwner !== owner) return 'LEASE_LOST';
    const turn = turns[0];
    if (!turn || ['COMPLETED', 'CANCELLED', 'ERROR'].includes(turn.status)) {
      await tx.coreV2JobOutbox.update({ where: { id: job.id }, data: { status: CoreV2JobStatus.COMPLETED, completedAt: now, leaseOwner: null, leaseExpiresAt: null, lastError: null } });
      return 'ALREADY_TERMINAL';
    }
    if (turn.status === 'RUNNING' && turn.cancellationRequestedAt) {
      await tx.ariaConversationTurnCoreV2.update({ where: { id: turn.id }, data: { status: 'CANCELLED', completedAt: now, heartbeatAt: now, leaseExpiresAt: null, executionMetadata: { ...(turn.executionMetadata && typeof turn.executionMetadata === 'object' && !Array.isArray(turn.executionMetadata) ? turn.executionMetadata : {}), reasonCode: 'USER_CANCELLED', recoveredAt: now.toISOString() } } });
      await tx.coreV2JobOutbox.update({ where: { id: job.id }, data: { status: CoreV2JobStatus.COMPLETED, completedAt: now, leaseOwner: null, leaseExpiresAt: null, lastError: null } });
      return 'RECOVERED';
    }
    if (turn.status === 'RUNNING' && turn.leaseExpiresAt && turn.leaseExpiresAt > now) {
      await tx.coreV2JobOutbox.update({ where: { id: job.id }, data: { status: CoreV2JobStatus.PENDING, availableAt: turn.leaseExpiresAt, leaseOwner: null, leaseExpiresAt: null, lastError: null } });
      return 'RESCHEDULED';
    }
    await tx.ariaConversationTurnCoreV2.update({ where: { id: turn.id }, data: { status: 'ERROR', completedAt: now, heartbeatAt: now, leaseExpiresAt: null, executionMetadata: { ...(turn.executionMetadata && typeof turn.executionMetadata === 'object' && !Array.isArray(turn.executionMetadata) ? turn.executionMetadata : {}), reasonCode: 'EXECUTION_INTERRUPTED', recoveredAt: now.toISOString() } } });
    await tx.coreV2JobOutbox.update({ where: { id: job.id }, data: { status: CoreV2JobStatus.COMPLETED, completedAt: now, leaseOwner: null, leaseExpiresAt: null, lastError: null } });
    return 'RECOVERED';
  });
}

export async function drainCoreV2AriaRecoveryOutbox(
  options: Readonly<{ limit?: number; owner?: string; now?: Date; leaseDurationMs?: number }> = {},
  database: Pick<PrismaClient, '$transaction' | 'coreV2JobOutbox'>,
): Promise<Readonly<{ claimed: number; recovered: number; rescheduled: number; alreadyTerminal: number; leaseLost: number; retried: number; failedFinal: number }>> {
  const now = options.now ?? new Date();
  const owner = options.owner?.trim() || `core-v2-aria-recovery-${process.pid}-${randomUUID()}`;
  const leaseDurationMs = options.leaseDurationMs ?? CORE_V2_ARIA_JOB_LEASE_MS;
  if (!Number.isSafeInteger(leaseDurationMs) || leaseDurationMs < 5_000 || leaseDurationMs > 300_000) throw new Error('CORE_V2_RECOVERY_LEASE_INVALID');
  const jobs = await claimCoreV2AriaRecoveryJobs(database, { limit: options.limit ?? 20, owner, now, leaseExpiresAt: new Date(now.getTime() + leaseDurationMs) });
  let recovered = 0; let rescheduled = 0; let alreadyTerminal = 0; let leaseLost = 0; let retried = 0; let failedFinal = 0;
  for (const job of jobs) {
    try {
      const disposition = await recoverClaimedJob(database, job, owner, now);
      if (disposition === 'RECOVERED') recovered += 1;
      else if (disposition === 'RESCHEDULED') rescheduled += 1;
      else if (disposition === 'ALREADY_TERMINAL') alreadyTerminal += 1;
      else leaseLost += 1;
    } catch (error: unknown) {
      const failureCode = safeFailureCode(error);
      const final = job.attemptCount >= MAX_RECOVERY_ATTEMPTS;
      const updated = await database.coreV2JobOutbox.updateMany({
        where: { id: job.id, status: CoreV2JobStatus.LEASED, leaseOwner: owner },
        data: final
          ? { status: CoreV2JobStatus.FAILED_FINAL, leaseOwner: null, leaseExpiresAt: null, lastError: failureCode }
          : { status: CoreV2JobStatus.RETRY_SCHEDULED, availableAt: new Date(now.getTime() + recoveryBackoffMs(job.attemptCount)), leaseOwner: null, leaseExpiresAt: null, lastError: failureCode },
      });
      if (updated.count === 1) { if (final) failedFinal += 1; else retried += 1; } else leaseLost += 1;
    }
  }
  return Object.freeze({ claimed: jobs.length, recovered, rescheduled, alreadyTerminal, leaseLost, retried, failedFinal });
}
