/**
 * Core v2 side of an account invitation under CORE_V2_AUTH_MODE=V1_ONLY.
 *
 * Core v1 is the SOLE authority for password, bcrypt hash, activation token,
 * reset, session and revocation. Core v2 therefore never receives, derives or
 * stores any of them. It records only:
 *   - the link to the v1 identity (`v1UserId`, unique),
 *   - the provisioning state of that link,
 *   - a monotonic request `generation`,
 * and drives the work through the existing CoreV2JobOutbox (one job type,
 * `ACCOUNT_V1_PROVISIONING`, whose payload a CHECK constraint restricts to a
 * closed non-secret key set). No new bus, no distributed transaction: every
 * step is a compare-and-set on (state, generation) and is safe to replay.
 *
 *   REQUESTED -> V1_ISSUE_PENDING -> SENT -> V1_ACTIVATED -> CORE_PROVISIONED
 *   plus DELIVERY_FAILED, PROVISIONING_RETRY, EXPIRED, CANCELLED.
 *
 * This file holds the Core-database half that the staff actor triggers
 * (request, resend, cancel). The worker that talks to Core v1 is
 * v1-provisioning-worker.ts.
 */
import { isInvitableRole } from '@/lib/auth/v1-account-invitation';
import { acquireV1InvitationIdentity, V1InvitationScopeRefusal, type V1IdentityLease } from '@/lib/auth/v1-invitation-authority';
import { assertInvitationScope, bindInvitationScope, invitationRequestAuthority, INVITATION_SCOPE_REFUSAL, type InvitationScope } from './invitation-scope';
import type { AccountProvisioningState, AccountV1Provisioning, User, PrismaClient } from '@/core-v2/generated/client';
import { appendAuditEvent } from '../audit';
import { CoreV2JobType } from '../client';
import { ConflictError, ForbiddenError, InvalidStateError, NotFoundError } from '../errors';
import type { ServiceContext, Tx } from '../services/context';
import { publicUser, type PublicUser } from '../http/respond';

export const V1_PROVISIONING_SCHEMA_VERSION = 'account-v1-provisioning/v1' as const;
export const V1_PROVISIONING_AGGREGATE_TYPE = 'ACCOUNT_V1_PROVISIONING' as const;

/** States from which the saga makes no further progress on its own. */
export const TERMINAL_PROVISIONING_STATES: readonly AccountProvisioningState[] = [
  'CORE_PROVISIONED', 'DELIVERY_FAILED', 'EXPIRED', 'CANCELLED',
];
/** States in which an invitation is on its way: an invite must not start another one. */
const IN_FLIGHT_STATES: readonly AccountProvisioningState[] = ['REQUESTED', 'V1_ISSUE_PENDING', 'SENT'];
/** States in which v1 already holds an active credential: only Core's own row is left to update. */
const V1_DONE_STATES: readonly AccountProvisioningState[] = ['V1_ACTIVATED', 'PROVISIONING_RETRY'];

export type ProvisioningJobKind = 'ADVANCE' | 'REVOKE';

export interface ProvisioningJobPayload {
  readonly schemaVersion: typeof V1_PROVISIONING_SCHEMA_VERSION;
  readonly userId: string;
  readonly generation: number;
  readonly kind: ProvisioningJobKind;
}

export function provisioningJobPayload(userId: string, generation: number, kind: ProvisioningJobKind): ProvisioningJobPayload {
  return { schemaVersion: V1_PROVISIONING_SCHEMA_VERSION, userId, generation, kind };
}

export function parseProvisioningJobPayload(raw: unknown, aggregateId: string): ProvisioningJobPayload {
  const keys = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? Object.keys(raw).sort().join(',') : '';
  const value = raw as Record<string, unknown>;
  if (
    keys !== 'generation,kind,schemaVersion,userId' ||
    value.schemaVersion !== V1_PROVISIONING_SCHEMA_VERSION ||
    value.userId !== aggregateId ||
    typeof value.generation !== 'number' || !Number.isSafeInteger(value.generation) || value.generation < 1 ||
    (value.kind !== 'ADVANCE' && value.kind !== 'REVOKE')
  ) {
    throw new Error('ACCOUNT_V1_PROVISIONING_PAYLOAD_INVALID');
  }
  return { schemaVersion: V1_PROVISIONING_SCHEMA_VERSION, userId: value.userId as string, generation: value.generation, kind: value.kind };
}

function generationJobKey(userId: string, generation: number): string {
  return `account-v1-provisioning:v1:${userId}:${generation}`;
}

async function enqueueProvisioningJob(
  tx: Tx, userId: string, generation: number, kind: ProvisioningJobKind, at: Date, idempotencyKey: string,
): Promise<string> {
  const job = await tx.coreV2JobOutbox.create({
    data: {
      jobType: CoreV2JobType.ACCOUNT_V1_PROVISIONING,
      aggregateType: V1_PROVISIONING_AGGREGATE_TYPE, aggregateId: userId,
      idempotencyKey, payload: { ...provisioningJobPayload(userId, generation, kind) }, availableAt: at,
    },
    select: { id: true },
  });
  return job.id;
}

export interface ProvisioningRequest {
  /** Recipient projection measured while both authorities are held. */
  readonly user: PublicUser;
  readonly provisioningId: string;
  readonly userId: string;
  readonly email: string;
  readonly generation: number;
  readonly state: AccountProvisioningState;
  /** The outbox job that drives this request; opaque, non-secret. */
  readonly handoffId: string;
  /** True when this call replayed an earlier identical command instead of starting a new one. */
  readonly replayed: boolean;
}

export interface ProvisioningRequestOptions {
  /** `true` = resend: supersedes an invitation already in flight. */
  readonly resend: boolean;
  /** Command-level retry identity (Idempotency-Key), already namespaced by the caller. */
  readonly commandKey?: string;
  readonly onAuthorized?: () => void | Promise<void>;
}

async function lockUser(tx: Tx, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM public."users" WHERE "id" = ${userId} FOR UPDATE`;
}

function dispositionOf(saga: AccountV1Provisioning, resend: boolean): 'RESTART' | 'REDRIVE' | 'REFUSE_IN_FLIGHT' {
  if (IN_FLIGHT_STATES.includes(saga.state)) return resend ? 'RESTART' : 'REFUSE_IN_FLIGHT';
  if (V1_DONE_STATES.includes(saga.state)) return 'REDRIVE';
  return 'RESTART';
}

/**
 * Records the intent to invite (or re-invite) a PENDING_ACTIVATION Core account
 * and queues the job that will carry it to Core v1. Capability checks are the
 * caller's job (services/account.ts). Nothing is sent from here and nothing
 * secret exists yet: the token is created later, inside Core v1, only.
 */
export async function requestV1Provisioning(
  client: PrismaClient, ctx: ServiceContext, userId: string, options: ProvisioningRequestOptions,
): Promise<ProvisioningRequest> {
  let lease: V1IdentityLease | undefined;
  try {
    return await client.$transaction(async tx => {
      const scope = await assertInvitationScope(tx, ctx.actor, options.resend ? 'RESEND' : 'INVITE', { userId });
      const target = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
      lease = await acquireV1InvitationIdentity({ issuerId: scope.issuerId, targetId: userId,
        recipient: target.email!, targetRole: scope.targetRole, ...invitationRequestAuthority(ctx) });
      await options.onAuthorized?.();
      await lease.verify();
      const request = await recordProvisioning(tx, ctx, userId, options, scope, lease.issuerVersion);
      await lease.verify();
      return request;
    });
  } catch (error) {
    if (error instanceof V1InvitationScopeRefusal) throw new ForbiddenError(INVITATION_SCOPE_REFUSAL);
    throw error;
  } finally { await lease?.release().catch(() => undefined); }
}

async function recordProvisioning(tx: Tx, ctx: ServiceContext, userId: string,
  options: ProvisioningRequestOptions, scope: InvitationScope, v1IssuerVersion: number): Promise<ProvisioningRequest> {
  await lockUser(tx, userId);
  const user: User | null = await tx.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('Account not found.', { userId });
  if (user.accountStatus !== 'PENDING_ACTIVATION') {
    throw new InvalidStateError(`Only a PENDING_ACTIVATION account can be invited (is ${user.accountStatus}).`, {
      userId, accountStatus: user.accountStatus,
    });
  }
  // Defence in depth on the ROLE, not only on the account status: an
  // administrator is never invited and never linked by this saga. Refusing here
  // means nothing is written and no job is enqueued, rather than relying on the
  // V1 step to decline later.
  if (!isInvitableRole(user.role)) {
    throw new ForbiddenError('This role is never provisioned through an invitation.', {
      code: 'ROLE_NOT_INVITABLE',
    });
  }
  if (!user.email) throw new InvalidStateError('The account has no email to deliver an invitation to.', { userId });
  const at = ctx.now();
  const saga = await tx.accountV1Provisioning.findUnique({ where: { userId } });
  const keyFor = (generation: number) => (options.commandKey ?? generationJobKey(userId, generation))
    + ':' + bindInvitationScope(scope, generation, v1IssuerVersion).fingerprint + ':g' + generation;
  if (saga && options.resend) {
    const old = saga.invitationBinding as { scope?: { targetId?: string; recipientDigest?: string; targetRole?: string } } | null;
    if (!old?.scope || old.scope.targetId !== userId || old.scope.recipientDigest !== scope.recipientDigest
      || old.scope.targetRole !== scope.targetRole) throw new ForbiddenError(INVITATION_SCOPE_REFUSAL);
  }

  if (options.commandKey) {
    const prior = await tx.coreV2JobOutbox.findFirst({ where: { idempotencyKey: { startsWith: options.commandKey + ':' } } });
    if (prior) {
      const payload = parseProvisioningJobPayload(prior.payload, prior.aggregateId);
      if (payload.userId !== userId) throw new ConflictError('Command identity is already bound to another request.');
      if (!saga || saga.generation !== payload.generation || TERMINAL_PROVISIONING_STATES.includes(saga.state)) {
        throw new InvalidStateError('The prior resend command is no longer eligible.');
      }
      const expected = bindInvitationScope(scope, saga.generation, v1IssuerVersion);
      if ((saga.invitationBinding as { fingerprint?: string } | null)?.fingerprint !== expected.fingerprint)
        throw new ForbiddenError(INVITATION_SCOPE_REFUSAL);
      return { user: publicUser(user), provisioningId: saga.id, userId, email: user.email, generation: saga.generation, state: saga.state, handoffId: prior.id, replayed: true };
    }
  }

  const auditAction = options.resend ? 'account.invitation_resent' : 'account.invited';
  if (!saga) {
    const created = await tx.accountV1Provisioning.create({ data: { userId, generation: 1, state: 'REQUESTED',
      requestedById: ctx.actor.userId, invitationBinding: bindInvitationScope(scope, 1, v1IssuerVersion) } });
    const handoffId = await enqueueProvisioningJob(tx, userId, 1, 'ADVANCE', at, keyFor(1));
    await auditRequest(tx, ctx, auditAction, created);
    return { user: publicUser(user), provisioningId: created.id, userId, email: user.email, generation: 1, state: 'REQUESTED', handoffId, replayed: false };
  }

  const disposition = dispositionOf(saga, options.resend);
  if (disposition === 'REFUSE_IN_FLIGHT') {
    throw new InvalidStateError('An invitation is already in progress; use resendInvitation.', { userId });
  }
  const generation = saga.generation + 1;
  const restarted = await tx.accountV1Provisioning.update({
    where: { id: saga.id },
    data: { generation, state: 'REQUESTED', invitationExpiresAt: null, lastErrorCode: null, requestedById: ctx.actor.userId, invitationBinding: bindInvitationScope(scope, generation, v1IssuerVersion) },
  });
  const handoffId = await enqueueProvisioningJob(tx, userId, generation, 'ADVANCE', at, keyFor(generation));
  await auditRequest(tx, ctx, auditAction, restarted);
  return { user: publicUser(user), provisioningId: restarted.id, userId, email: user.email, generation, state: 'REQUESTED', handoffId, replayed: false };
}

async function auditRequest(tx: Tx, ctx: ServiceContext, action: 'account.invited' | 'account.invitation_resent', saga: AccountV1Provisioning): Promise<void> {
  await appendAuditEvent(tx, {
    actorUserId: ctx.actor.userId, action, subjectType: 'User', subjectId: saga.userId,
    correlationId: ctx.correlationId, metadata: { via: 'V1', generation: saga.generation },
  });
}

/**
 * Withdraws a request that has not been provisioned (the Core account was
 * disabled). Safe to call for any user: with no saga, or one that is already
 * terminal, it does nothing. A v1 credential is NEVER touched; only the
 * pending, unactivated v1 token of this request is revoked, by a follow-up job.
 */
export async function cancelV1Provisioning(tx: Tx, userId: string, at: Date, code: string): Promise<void> {
  const saga = await tx.accountV1Provisioning.findUnique({ where: { userId } });
  if (!saga || TERMINAL_PROVISIONING_STATES.includes(saga.state)) return;
  await tx.accountV1Provisioning.update({ where: { id: saga.id }, data: { state: 'CANCELLED', lastErrorCode: code } });
  await enqueueProvisioningJob(tx, userId, saga.generation, 'REVOKE', at, `${generationJobKey(userId, saga.generation)}:revoke`);
}
