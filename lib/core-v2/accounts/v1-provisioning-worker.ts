/**
 * Drives the account-provisioning saga (see v1-provisioning.ts) from the Core
 * v2 job outbox to Core v1 and back.
 *
 * Every step is a compare-and-set on (id, generation, state) followed by an
 * idempotent call to Core v1, so the loop can be killed and re-run at ANY
 * boundary:
 *
 *   REQUESTED ---------> V1_ISSUE_PENDING   (Core CAS)
 *   V1_ISSUE_PENDING --> SENT               (v1 issued + e-mail queued in v1)
 *                    --> V1_ACTIVATED       (v1 account was already active: link only)
 *                    --> CANCELLED          (v1 refused: suspended, collision, ...)
 *   SENT --------------> V1_ACTIVATED       (the person set a password in v1)
 *                    --> EXPIRED / DELIVERY_FAILED / CANCELLED
 *   V1_ACTIVATED ------> CORE_PROVISIONED   (Core row ACTIVE, one Core transaction)
 *   a Core failure ----> PROVISIONING_RETRY (never touches the v1 account)
 *
 * The raw token, its hash and any password exist only inside Core v1. What the
 * gateway returns to this file is an outcome code, a v1 user id and an expiry.
 */
import { randomUUID } from 'node:crypto';
import type { AccountProvisioningState, AccountV1Provisioning, CoreV2JobOutbox, PrismaClient, User } from '@/core-v2/generated/client';
import {
  inspectV1Account, issueV1AccountInvitation, revokeV1AccountInvitation,
  type V1AccountView, type V1InvitationTarget, type V1IssueOutcome,
} from '@/lib/auth/v1-account-invitation';
import { appendAuditEvent } from '../audit';
import { Prisma, CoreV2JobStatus, CoreV2JobType } from '../client';
import {
  parseProvisioningJobPayload, TERMINAL_PROVISIONING_STATES, V1_PROVISIONING_AGGREGATE_TYPE,
  type ProvisioningJobPayload,
} from './v1-provisioning';

const MAX_ATTEMPTS = 50;
const LEASE_MS = 60_000;
const MAX_STEPS_PER_JOB = 8;

/** The three things Core is allowed to ask Core v1. Replaceable at the boundary for fault injection. */
export interface V1Gateway {
  issue(target: V1InvitationTarget, now: Date): Promise<V1IssueOutcome>;
  inspect(target: V1InvitationTarget): Promise<V1AccountView>;
  revoke(input: { coreUserId: string; generation: number }): Promise<{ revoked: boolean }>;
}

export const defaultV1Gateway: V1Gateway = {
  issue: (target, now) => issueV1AccountInvitation(target, { now }),
  inspect: (target) => inspectV1Account(target),
  revoke: (input) => revokeV1AccountInvitation(input),
};

export interface V1ProvisioningWorkerOptions {
  readonly owner?: string;
  readonly limit?: number;
  readonly now: () => Date;
  readonly gateway?: V1Gateway;
  /** How long a job waits between two looks at a SENT invitation. */
  readonly pollMs?: number;
}

export interface V1ProvisioningMetrics {
  readonly claimed: number;
  readonly completed: number;
  readonly waiting: number;
  readonly retried: number;
  readonly leaseLost: number;
  readonly failedFinal: number;
  /** Invitation e-mails newly queued in Core v1 during this drain. */
  readonly issued: number;
}

type StepResult =
  | Readonly<{ kind: 'DONE' }>
  | Readonly<{ kind: 'WAIT' }>;

/** A business refusal of Core's own row (never a v1 mutation). */
class CoreRowRefusal extends Error {
  constructor(readonly code: string) { super(code); }
}

function errorCode(error: unknown, fallback: string): string {
  if (error instanceof CoreRowRefusal) return error.code;
  const code = error instanceof Error ? error.message : '';
  return /^[A-Z0-9_]{1,64}$/.test(code) ? code : fallback;
}

function targetOf(user: User, generation: number): V1InvitationTarget | null {
  if (!user.email) return null;
  return {
    coreUserId: user.id, email: user.email, role: user.role,
    firstName: user.firstName, lastName: user.lastName, phone: user.phone, generation,
  };
}

async function compareAndSet(
  core: PrismaClient, saga: AccountV1Provisioning, from: readonly AccountProvisioningState[],
  data: Prisma.AccountV1ProvisioningUncheckedUpdateManyInput,
): Promise<boolean> {
  const moved = await core.accountV1Provisioning.updateMany({
    where: { id: saga.id, generation: saga.generation, state: { in: [...from] } },
    data,
  });
  return moved.count === 1;
}

async function cancel(core: PrismaClient, saga: AccountV1Provisioning, code: string): Promise<StepResult> {
  await compareAndSet(core, saga, ['REQUESTED', 'V1_ISSUE_PENDING', 'SENT', 'V1_ACTIVATED', 'PROVISIONING_RETRY'], {
    state: 'CANCELLED', lastErrorCode: code,
  });
  return { kind: 'DONE' };
}

/**
 * Brings Core's own `users` row up to date once v1 holds an active credential.
 * One Core transaction: the row becomes ACTIVE (no password, no hash, no
 * session bump: those are v1's), the saga reaches CORE_PROVISIONED, the audit
 * row is written. All or nothing.
 */
async function provisionCore(core: PrismaClient, saga: AccountV1Provisioning, v1UserId: string, activatedAt: Date | null, at: Date): Promise<void> {
  await core.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${saga.userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: saga.userId } });
    if (!user) throw new CoreRowRefusal('CORE_ACCOUNT_NOT_FOUND');
    if (user.accountStatus === 'PENDING_ACTIVATION') {
      await tx.user.update({ where: { id: user.id }, data: { accountStatus: 'ACTIVE', activatedAt: activatedAt ?? at } });
    } else if (user.accountStatus !== 'ACTIVE') {
      throw new CoreRowRefusal('CORE_ACCOUNT_NOT_ELIGIBLE');
    }
    const moved = await tx.accountV1Provisioning.updateMany({
      where: { id: saga.id, generation: saga.generation, state: { in: ['V1_ACTIVATED', 'PROVISIONING_RETRY'] } },
      data: { state: 'CORE_PROVISIONED', v1UserId, lastErrorCode: null },
    });
    if (moved.count !== 1) throw new CoreRowRefusal('ACCOUNT_V1_PROVISIONING_STATE_CHANGED');
    await appendAuditEvent(tx, {
      actorUserId: saga.userId, action: 'account.activated', subjectType: 'User', subjectId: saga.userId,
      correlationId: `account-v1-provisioning:${saga.id}:${saga.generation}`,
      metadata: { via: 'V1', generation: saga.generation },
    });
  }, { maxWait: 5_000, timeout: 20_000 });
}

async function advance(
  core: PrismaClient, gateway: V1Gateway, payload: ProvisioningJobPayload,
  options: { now: () => Date },
  tally: { issued: number },
): Promise<StepResult> {
  for (let step = 0; step < MAX_STEPS_PER_JOB; step += 1) {
    const saga = await core.accountV1Provisioning.findUnique({ where: { userId: payload.userId } });
    // Superseded by a newer request, or already settled: nothing left for this job.
    if (!saga || saga.generation !== payload.generation || TERMINAL_PROVISIONING_STATES.includes(saga.state)) {
      return { kind: 'DONE' };
    }
    const user = await core.user.findUnique({ where: { id: payload.userId } });
    if (!user) return cancel(core, saga, 'CORE_ACCOUNT_NOT_FOUND');
    if (user.accountStatus === 'DISABLED' || user.accountStatus === 'SUSPENDED') {
      return cancel(core, saga, 'CORE_ACCOUNT_NOT_ELIGIBLE');
    }
    const target = targetOf(user, saga.generation);
    if (!target) return cancel(core, saga, 'CORE_ACCOUNT_NO_EMAIL');
    const at = options.now();

    switch (saga.state) {
      case 'REQUESTED':
        await compareAndSet(core, saga, ['REQUESTED'], { state: 'V1_ISSUE_PENDING' });
        break;

      case 'V1_ISSUE_PENDING': {
        const outcome = await gateway.issue(target, at);
        if (outcome.outcome === 'REFUSED') {
          // A newer generation already issued: this job is obsolete, not failed.
          if (outcome.code === 'V1_GENERATION_STALE') return { kind: 'DONE' };
          return cancel(core, saga, outcome.code);
        }
        if (outcome.outcome === 'ACTIVE_LINKED') {
          await compareAndSet(core, saga, ['V1_ISSUE_PENDING'], { state: 'V1_ACTIVATED', v1UserId: outcome.v1UserId, lastErrorCode: null });
        } else {
          const moved = await compareAndSet(core, saga, ['V1_ISSUE_PENDING'], {
            state: 'SENT', v1UserId: outcome.v1UserId, invitationExpiresAt: outcome.expiresAt, lastErrorCode: null,
          });
          if (moved && !outcome.replayed) tally.issued += 1;
        }
        break;
      }

      case 'SENT': {
        const view = await gateway.inspect(target);
        if (view.state === 'ACTIVE') {
          await compareAndSet(core, saga, ['SENT'], { state: 'V1_ACTIVATED', v1UserId: view.v1UserId, lastErrorCode: null });
          break;
        }
        if (view.state === 'REFUSED') return cancel(core, saga, view.code);
        if (saga.invitationExpiresAt && at >= saga.invitationExpiresAt) {
          await compareAndSet(core, saga, ['SENT'], { state: 'EXPIRED', lastErrorCode: 'INVITATION_EXPIRED' });
          return { kind: 'DONE' };
        }
        if (view.delivery === 'FAILED') {
          await compareAndSet(core, saga, ['SENT'], { state: 'DELIVERY_FAILED', lastErrorCode: 'EMAIL_DELIVERY_FAILED' });
          return { kind: 'DONE' };
        }
        return { kind: 'WAIT' };
      }

      case 'V1_ACTIVATED':
      case 'PROVISIONING_RETRY': {
        const view = await gateway.inspect(target);
        if (view.state !== 'ACTIVE') {
          return cancel(core, saga, view.state === 'REFUSED' ? view.code : 'V1_ACCOUNT_NOT_ACTIVE');
        }
        try {
          await provisionCore(core, saga, view.v1UserId, view.activatedAt, at);
        } catch (error) {
          if (error instanceof CoreRowRefusal) return cancel(core, saga, error.code);
          // A Core failure after v1 activation never cancels or alters the v1 account.
          await compareAndSet(core, saga, ['V1_ACTIVATED', 'PROVISIONING_RETRY'], {
            state: 'PROVISIONING_RETRY', lastErrorCode: 'CORE_PROVISIONING_FAILED',
          }).catch(() => false);
          throw error;
        }
        return { kind: 'DONE' };
      }

      default:
        return { kind: 'DONE' };
    }
  }
  return { kind: 'WAIT' };
}

export async function drainV1Provisioning(database: PrismaClient, options: V1ProvisioningWorkerOptions): Promise<V1ProvisioningMetrics> {
  const owner = options.owner ?? randomUUID();
  const limit = options.limit ?? 20;
  const gateway = options.gateway ?? defaultV1Gateway;
  const pollMs = options.pollMs ?? 30_000;
  const at = options.now();
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !owner || owner.length > 128 || !Number.isFinite(at.getTime()) || pollMs < 0) {
    throw new Error('ACCOUNT_V1_PROVISIONING_WORKER_OPTIONS_INVALID');
  }
  const exhausted = await database.coreV2JobOutbox.updateMany({
    where: {
      jobType: CoreV2JobType.ACCOUNT_V1_PROVISIONING, aggregateType: V1_PROVISIONING_AGGREGATE_TYPE,
      status: CoreV2JobStatus.LEASED, leaseExpiresAt: { lte: at }, attemptCount: { gte: MAX_ATTEMPTS },
    },
    data: { status: CoreV2JobStatus.FAILED_FINAL, leaseOwner: null, leaseExpiresAt: null, lastError: 'ACCOUNT_V1_PROVISIONING_ATTEMPTS_EXHAUSTED' },
  });

  const claim = () => database.$transaction(async (tx) => {
    const selected = await tx.$queryRaw<CoreV2JobOutbox[]>(Prisma.sql`
      SELECT * FROM core_v2_job_outbox
      WHERE "jobType" = ${CoreV2JobType.ACCOUNT_V1_PROVISIONING}::"CoreV2JobType"
        AND "aggregateType" = ${V1_PROVISIONING_AGGREGATE_TYPE}
        AND "attemptCount" < ${MAX_ATTEMPTS}
        AND ((status IN ('PENDING', 'RETRY_SCHEDULED') AND "availableAt" <= ${options.now()})
          OR (status = 'LEASED' AND "leaseExpiresAt" <= ${options.now()}))
      ORDER BY "availableAt", "createdAt", id
      FOR UPDATE SKIP LOCKED LIMIT 1
    `);
    for (const job of selected) {
      await tx.coreV2JobOutbox.update({ where: { id: job.id }, data: {
        status: CoreV2JobStatus.LEASED, leaseOwner: owner, leaseExpiresAt: new Date(options.now().getTime() + LEASE_MS),
      } });
    }
    return selected;
  });

  const tally = { issued: 0 };
  let claimed = 0; let completed = 0; let waiting = 0; let retried = 0; let leaseLost = 0; let failedFinal = exhausted.count;
  for (let index = 0; index < limit; index += 1) {
    const jobs = await claim();
    if (jobs.length === 0) break;
    claimed += jobs.length;
    const job = jobs[0];
    const owned = { id: job.id, status: CoreV2JobStatus.LEASED, leaseOwner: owner, leaseExpiresAt: { gt: options.now() } };
    try {
      const payload = parseProvisioningJobPayload(job.payload, job.aggregateId);
      const result: StepResult = payload.kind === 'REVOKE'
        ? (await gateway.revoke({ coreUserId: payload.userId, generation: payload.generation }), { kind: 'DONE' })
        : await advance(database, gateway, payload, { now: options.now }, tally);
      const updated = await database.coreV2JobOutbox.updateMany({
        where: owned,
        data: result.kind === 'DONE'
          ? { status: CoreV2JobStatus.COMPLETED, completedAt: options.now(), leaseOwner: null, leaseExpiresAt: null, lastError: null }
          : { status: CoreV2JobStatus.RETRY_SCHEDULED, availableAt: new Date(options.now().getTime() + pollMs), leaseOwner: null, leaseExpiresAt: null, lastError: null },
      });
      if (!updated.count) leaseLost += 1;
      else if (result.kind === 'DONE') completed += 1;
      else waiting += 1;
    } catch (error) {
      const attempt = job.attemptCount + 1;
      const terminal = attempt >= MAX_ATTEMPTS;
      const result = await database.coreV2JobOutbox.updateMany({
        where: owned,
        data: {
          status: terminal ? CoreV2JobStatus.FAILED_FINAL : CoreV2JobStatus.RETRY_SCHEDULED,
          attemptCount: { increment: 1 },
          availableAt: new Date(options.now().getTime() + Math.min(5_000 * 2 ** Math.min(attempt - 1, 6), 300_000)),
          leaseOwner: null, leaseExpiresAt: null,
          lastError: errorCode(error, 'ACCOUNT_V1_PROVISIONING_STEP_FAILED'),
        },
      });
      if (!result.count) leaseLost += 1;
      else if (terminal) failedFinal += 1;
      else retried += 1;
    }
  }
  return Object.freeze({ claimed, completed, waiting, retried, leaseLost, failedFinal, issued: tally.issued });
}
