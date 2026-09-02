import { randomUUID } from 'node:crypto';
import {
  AriaConversationTurnStatus,
  Prisma,
  type JobOutbox,
  type PrismaClient,
} from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { claimAriaTurnRecoveryJobs } from './fenced-claim';

const recoveryPayloadSchema = z.object({ turnId: z.string().min(1) }).strict();
const DEFAULT_JOB_LEASE_MS = 30_000;
const DEFAULT_RETRY_MS = 5_000;

type RecoveryDatabase = Pick<PrismaClient, '$transaction' | 'jobOutbox'>;
type RecoveryDisposition = 'RECOVERED' | 'RESCHEDULED' | 'ALREADY_TERMINAL' | 'LEASE_LOST';

export interface AriaTurnRecoveryWorkerDependencies {
  readonly database: RecoveryDatabase;
  readonly log: Pick<typeof logger, 'info' | 'error'>;
}

const defaultDependencies: AriaTurnRecoveryWorkerDependencies = {
  database: prisma,
  log: logger,
};

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < min || resolved > max) {
    throw new Error('ARIA_TURN_RECOVERY_POLICY_INVALID');
  }
  return resolved;
}

function safeExecutionMetadata(value: Prisma.JsonValue | null): Prisma.InputJsonObject {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};
  return value as Prisma.InputJsonObject;
}

function safeFailureCode(error: unknown): string {
  if (error instanceof z.ZodError) return 'RECOVERY_PAYLOAD_INVALID';
  if (error instanceof Error && error.message === 'ARIA_RECOVERY_JOB_IDENTITY_MISMATCH') {
    return 'RECOVERY_JOB_IDENTITY_MISMATCH';
  }
  return 'RECOVERY_OPERATION_FAILED';
}

async function recoverClaimedJob(
  database: RecoveryDatabase,
  job: JobOutbox,
  owner: string,
  now: Date,
): Promise<RecoveryDisposition> {
  const payload = recoveryPayloadSchema.parse(job.payload);
  if (payload.turnId !== job.aggregateId) throw new Error('ARIA_RECOVERY_JOB_IDENTITY_MISMATCH');

  return database.$transaction(async (transaction) => {
    type LockedTurn = {
      id: string;
      status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'ERROR';
      executionToken: string | null;
      leaseExpiresAt: Date | null;
      cancellationRequestedAt: Date | null;
      executionMetadata: Prisma.JsonValue | null;
    };
    const turns = await transaction.$queryRaw<LockedTurn[]>(Prisma.sql`
      SELECT id, status::text, "executionToken", "leaseExpiresAt",
             "cancellationRequestedAt", "executionMetadata"
      FROM aria_conversation_turns
      WHERE id = ${payload.turnId}
      FOR UPDATE
    `);
    const lockedJobs = await transaction.$queryRaw<Array<{
      id: string;
      status: string;
      leaseOwner: string | null;
    }>>(Prisma.sql`
      SELECT id, status::text, "leaseOwner"
      FROM canonical_job_outbox
      WHERE id = ${job.id}
      FOR UPDATE
    `);
    const lockedJob = lockedJobs[0];
    if (!lockedJob || lockedJob.status !== 'LEASED' || lockedJob.leaseOwner !== owner) {
      return 'LEASE_LOST';
    }
    const turn = turns[0];
    if (!turn) {
      await transaction.jobOutbox.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED', completedAt: now, attemptCount: { increment: 1 },
          leaseOwner: null, leaseExpiresAt: null, lastError: null,
        },
      });
      return 'ALREADY_TERMINAL';
    }
    if (['COMPLETED', 'CANCELLED', 'ERROR'].includes(turn.status)) {
      await transaction.jobOutbox.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED', completedAt: now, attemptCount: { increment: 1 },
          leaseOwner: null, leaseExpiresAt: null, lastError: null,
        },
      });
      return 'ALREADY_TERMINAL';
    }
    if (
      turn.status === 'RUNNING'
      && turn.cancellationRequestedAt === null
      && turn.leaseExpiresAt
      && turn.leaseExpiresAt > now
    ) {
      await transaction.jobOutbox.update({
        where: { id: job.id },
        data: {
          status: 'PENDING', availableAt: turn.leaseExpiresAt,
          leaseOwner: null, leaseExpiresAt: null, lastError: null,
        },
      });
      return 'RESCHEDULED';
    }

    const terminalStatus = turn.cancellationRequestedAt
      ? AriaConversationTurnStatus.CANCELLED
      : AriaConversationTurnStatus.ERROR;
    const reasonCode = terminalStatus === AriaConversationTurnStatus.CANCELLED
      ? 'USER_CANCELLED'
      : 'EXECUTION_INTERRUPTED';
    await transaction.ariaConversationTurn.update({
      where: { id: turn.id },
      data: {
        status: terminalStatus,
        completedAt: now,
        heartbeatAt: now,
        leaseExpiresAt: null,
        executionMetadata: {
          ...safeExecutionMetadata(turn.executionMetadata),
          reasonCode,
          recoveredAt: now.toISOString(),
        },
      },
    });
    await transaction.jobOutbox.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED', completedAt: now, attemptCount: { increment: 1 },
        leaseOwner: null, leaseExpiresAt: null, lastError: null,
      },
    });
    return 'RECOVERED';
  });
}

export async function drainAriaTurnRecoveryOutbox(
  options: Readonly<{
    limit?: number;
    owner?: string;
    now?: Date;
    leaseDurationMs?: number;
    retryDelayMs?: number;
  }> = {},
  dependencies: Partial<AriaTurnRecoveryWorkerDependencies> = {},
): Promise<Readonly<{
  claimed: number;
  recovered: number;
  rescheduled: number;
  alreadyTerminal: number;
  leaseLost: number;
  retried: number;
}>> {
  const deps = { ...defaultDependencies, ...dependencies };
  const limit = boundedInteger(options.limit, 20, 1, 100);
  const leaseDurationMs = boundedInteger(options.leaseDurationMs, DEFAULT_JOB_LEASE_MS, 5_000, 300_000);
  const retryDelayMs = boundedInteger(options.retryDelayMs, DEFAULT_RETRY_MS, 250, 60_000);
  const owner = options.owner?.trim() || `aria-recovery-${process.pid}-${randomUUID()}`;
  const now = options.now ?? new Date();
  const jobs = await claimAriaTurnRecoveryJobs(deps.database, {
    limit,
    owner,
    now,
    leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
  });
  let recovered = 0;
  let rescheduled = 0;
  let alreadyTerminal = 0;
  let leaseLost = 0;
  let retried = 0;

  for (const job of jobs) {
    try {
      const disposition = await recoverClaimedJob(deps.database, job, owner, now);
      if (disposition === 'RECOVERED') recovered += 1;
      else if (disposition === 'RESCHEDULED') rescheduled += 1;
      else if (disposition === 'ALREADY_TERMINAL') alreadyTerminal += 1;
      else leaseLost += 1;
      deps.log.info({
        event: 'ARIA_TURN_RECOVERY_PROCESSED',
        turnId: job.aggregateId,
        jobId: job.id,
        disposition,
      });
    } catch (error: unknown) {
      const failureCode = safeFailureCode(error);
      const updated = await deps.database.jobOutbox.updateMany({
        where: { id: job.id, status: 'LEASED', leaseOwner: owner },
        data: {
          status: 'RETRY_SCHEDULED',
          attemptCount: { increment: 1 },
          availableAt: new Date(now.getTime() + retryDelayMs),
          leaseOwner: null,
          leaseExpiresAt: null,
          lastError: failureCode,
        },
      });
      if (updated.count === 1) retried += 1;
      else leaseLost += 1;
      deps.log.error({
        event: 'ARIA_TURN_RECOVERY_FAILED',
        turnId: job.aggregateId,
        jobId: job.id,
        failureCode,
        retryScheduled: updated.count === 1,
      });
    }
  }
  return Object.freeze({
    claimed: jobs.length, recovered, rescheduled, alreadyTerminal, leaseLost, retried,
  });
}
