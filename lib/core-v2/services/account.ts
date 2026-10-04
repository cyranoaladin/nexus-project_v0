/**
 * Account lifecycle (§U/§V/§W/§X): User.accountStatus is the single authority,
 * Invitation has its own lifecycle, sessionVersion is the revocation lever.
 *
 *   PENDING_ACTIVATION --activate(token)--> ACTIVE --suspend--> SUSPENDED --reactivate--> ACTIVE
 *   {PENDING_ACTIVATION, ACTIVE, SUSPENDED} --disable--> DISABLED (terminal)
 *
 * Invitation tokens: 32 random bytes, version/key-id plus base64url on the wire, dedicated HMAC-SHA256 at rest;
 * the raw token is returned ONCE to the caller (mail layer) and never logged
 * or audited. Password hashes: bcrypt, same cost as the live app so a
 * migrated hash stays verifiable without a forced reset.
 */
import { randomBytes } from 'node:crypto';
import { accountTokenDigest, createAccountToken } from '../account-token';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Invitation, PrismaClient, User } from '@/core-v2/generated/client';
import { appendAuditEvent } from '../audit';
import { getInvitationTtlMs, getPasswordResetTtlMs } from '../config';
import { normalizeEmail } from '../contact';
import { ConflictError, ForbiddenError, InvalidStateError, NotFoundError, isUniqueViolation } from '../errors';
import { assertActorOwnsIdentity, assertCapability } from '../rbac';
import type { ServiceContext, Tx } from './context';
import { inTransaction } from './context';
import { idSchema, parseInput } from './validation';
import { newPasswordSchema as passwordSchema } from '@/lib/security/password-policy';

const BCRYPT_COST = 12;

async function issueInvitation(
  tx: Tx,
  ctx: ServiceContext,
  user: User,
  action: 'account.invited' | 'account.invitation_resent',
): Promise<{ invitation: Invitation; rawToken: string; revokedCount: number }> {
  if (user.accountStatus !== 'PENDING_ACTIVATION') {
    throw new InvalidStateError(`Only a PENDING_ACTIVATION account can be invited (is ${user.accountStatus}).`, {
      userId: user.id,
      accountStatus: user.accountStatus,
    });
  }
  if (!user.email) {
    throw new InvalidStateError('The account has no email to deliver an invitation to.', { userId: user.id });
  }
  const now = ctx.now();
  const revoked = await tx.invitation.updateMany({
    where: { userId: user.id, purpose: 'ACTIVATION', consumedAt: null, revokedAt: null },
    data: { revokedAt: now },
  });
  const { rawToken, tokenHash } = createAccountToken('ACTIVATION');
  let invitation: Invitation;
  try {
    invitation = await tx.invitation.create({
      data: {
        userId: user.id,
        purpose: 'ACTIVATION',
        tokenHash,
        expiresAt: new Date(now.getTime() + getInvitationTtlMs()),
        issuedById: ctx.actor.userId,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError('An invitation was issued concurrently for this account.', { userId: user.id });
    }
    throw error;
  }
  await appendAuditEvent(tx, {
    actorUserId: ctx.actor.userId,
    action,
    subjectType: 'Invitation',
    subjectId: invitation.id,
    correlationId: ctx.correlationId,
    metadata: { userId: user.id, revokedPrior: revoked.count, expiresAt: invitation.expiresAt.toISOString() },
  });
  return { invitation, rawToken, revokedCount: revoked.count };
}

export type IssuedInvitation = { invitation: Invitation; rawToken: string; email: string };

export async function inviteAccount(client: PrismaClient, ctx: ServiceContext, rawUserId: string): Promise<IssuedInvitation> {
  assertCapability(ctx.actor, 'ACCOUNT_INVITE');
  const userId = parseInput(idSchema, rawUserId);
  return inTransaction(client, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('Account not found.', { userId });
    const open = await tx.invitation.count({ where: { userId, purpose: 'ACTIVATION', consumedAt: null, revokedAt: null, expiresAt: { gt: ctx.now() } } });
    if (open > 0) {
      throw new InvalidStateError('An open invitation already exists; use resendInvitation.', { userId });
    }
    const issued = await issueInvitation(tx, ctx, user, 'account.invited');
    return { invitation: issued.invitation, rawToken: issued.rawToken, email: user.email as string };
  });
}

/** Idempotent resend: always revokes any prior open invitation and issues exactly one new token. */
export async function resendInvitation(client: PrismaClient, ctx: ServiceContext, rawUserId: string): Promise<IssuedInvitation> {
  assertCapability(ctx.actor, 'ACCOUNT_INVITE');
  const userId = parseInput(idSchema, rawUserId);
  return inTransaction(client, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('Account not found.', { userId });
    const issued = await issueInvitation(tx, ctx, user, 'account.invitation_resent');
    return { invitation: issued.invitation, rawToken: issued.rawToken, email: user.email as string };
  });
}

export interface InvitationPreview {
  readonly email: string;
  readonly role: User['role'];
  readonly firstName: string | null;
}

/**
 * Read-only preview for the activation page: who the open, unexpired
 * invitation is for. Never consumes anything; null for every refusal so the
 * shape reveals nothing about tokens that never existed.
 */
export async function inspectInvitation(
  client: PrismaClient,
  rawToken: string,
  now: () => Date = () => new Date(),
): Promise<InvitationPreview | null> {
  if (typeof rawToken !== 'string' || rawToken.length < 16 || rawToken.length > 128) return null;
  const tokenHash = accountTokenDigest(rawToken, 'ACTIVATION');
  if (!tokenHash) return null;
  const invitation = await client.invitation.findUnique({
    where: { tokenHash },
    include: { user: { select: { email: true, role: true, firstName: true, accountStatus: true } } },
  });
  if (!invitation || invitation.purpose !== 'ACTIVATION' || invitation.consumedAt || invitation.revokedAt || invitation.expiresAt <= now()) return null;
  if (invitation.user.accountStatus !== 'PENDING_ACTIVATION' || !invitation.user.email) return null;
  return { email: invitation.user.email, role: invitation.user.role, firstName: invitation.user.firstName };
}

const activateSchema = z.object({ rawToken: z.string().min(16).max(128), password: passwordSchema });

export type ActivateAccountInput = z.input<typeof activateSchema>;

/**
 * Public, token-authenticated, atomic: consumes the invitation and activates
 * the account in one transaction. Every failure is the same NOT_FOUND/
 * INVALID_STATE pair regardless of whether the token ever existed (no
 * enumeration through error shape).
 */
export async function activateAccount(
  client: PrismaClient,
  rawInput: ActivateAccountInput,
  options: { now?: () => Date; correlationId?: string } = {},
): Promise<User> {
  const input = parseInput(activateSchema, rawInput);
  const now = options.now ?? (() => new Date());
  const tokenHash = accountTokenDigest(input.rawToken, 'ACTIVATION');
  if (!tokenHash) throw new NotFoundError('Invitation not found or no longer valid.');

  return inTransaction(client, async (tx) => {
    const invitation = await tx.invitation.findUnique({ where: { tokenHash } });
    if (!invitation || invitation.purpose !== 'ACTIVATION') throw new NotFoundError('Invitation not found or no longer valid.');
    const at = now();
    if (invitation.consumedAt || invitation.revokedAt || invitation.expiresAt <= at) {
      throw new InvalidStateError('Invitation not found or no longer valid.');
    }
    const consumed = await tx.invitation.updateMany({
      where: { id: invitation.id, consumedAt: null, revokedAt: null },
      data: { consumedAt: at },
    });
    if (consumed.count !== 1) throw new InvalidStateError('Invitation not found or no longer valid.');

    const password = await bcrypt.hash(input.password, BCRYPT_COST);
    const activated = await tx.user.updateMany({
      where: { id: invitation.userId, accountStatus: 'PENDING_ACTIVATION' },
      data: { accountStatus: 'ACTIVE', password, activatedAt: at, sessionVersion: { increment: 1 } },
    });
    if (activated.count !== 1) throw new InvalidStateError('Invitation not found or no longer valid.');

    await appendAuditEvent(tx, {
      actorUserId: invitation.userId,
      action: 'account.activated',
      subjectType: 'User',
      subjectId: invitation.userId,
      correlationId: options.correlationId ?? invitation.id,
      metadata: { invitationId: invitation.id },
    });
    return tx.user.findUniqueOrThrow({ where: { id: invitation.userId } });
  });
}

async function transitionAccount(
  tx: Tx,
  ctx: ServiceContext,
  userId: string,
  from: readonly User['accountStatus'][],
  to: User['accountStatus'],
  action: 'account.suspended' | 'account.reactivated' | 'account.disabled',
  revokeSessions: boolean,
): Promise<User> {
  const before = await tx.user.findUnique({ where: { id: userId } });
  if (!before) throw new NotFoundError('Account not found.', { userId });
  const moved = await tx.user.updateMany({
    where: { id: userId, accountStatus: { in: [...from] } },
    data: { accountStatus: to, ...(revokeSessions ? { sessionVersion: { increment: 1 } } : {}) },
  });
  if (moved.count !== 1) {
    throw new InvalidStateError(`Cannot move account from ${before.accountStatus} to ${to}.`, {
      userId,
      accountStatus: before.accountStatus,
    });
  }
  await appendAuditEvent(tx, {
    actorUserId: ctx.actor.userId,
    action,
    subjectType: 'User',
    subjectId: userId,
    correlationId: ctx.correlationId,
    metadata: { from: before.accountStatus, to, sessionsRevoked: revokeSessions },
  });
  return tx.user.findUniqueOrThrow({ where: { id: userId } });
}

export async function suspendAccount(client: PrismaClient, ctx: ServiceContext, rawUserId: string): Promise<User> {
  assertCapability(ctx.actor, 'ACCOUNT_SUSPEND');
  const userId = parseInput(idSchema, rawUserId);
  if (userId === ctx.actor.userId) throw new InvalidStateError('An actor cannot suspend their own account.', { userId });
  return inTransaction(client, (tx) => transitionAccount(tx, ctx, userId, ['ACTIVE'], 'SUSPENDED', 'account.suspended', true));
}

export async function reactivateAccount(client: PrismaClient, ctx: ServiceContext, rawUserId: string): Promise<User> {
  assertCapability(ctx.actor, 'ACCOUNT_REACTIVATE');
  const userId = parseInput(idSchema, rawUserId);
  return inTransaction(client, (tx) => transitionAccount(tx, ctx, userId, ['SUSPENDED'], 'ACTIVE', 'account.reactivated', false));
}

/** Terminal. Also revokes any open invitation so a disabled account can never be activated later. */
export async function disableAccount(client: PrismaClient, ctx: ServiceContext, rawUserId: string): Promise<User> {
  assertCapability(ctx.actor, 'ACCOUNT_SUSPEND');
  const userId = parseInput(idSchema, rawUserId);
  if (userId === ctx.actor.userId) throw new InvalidStateError('An actor cannot disable their own account.', { userId });
  return inTransaction(client, async (tx) => {
    const user = await transitionAccount(
      tx,
      ctx,
      userId,
      ['PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED'],
      'DISABLED',
      'account.disabled',
      true,
    );
    await tx.invitation.updateMany({ where: { userId, consumedAt: null, revokedAt: null }, data: { revokedAt: ctx.now() } });
    return user;
  });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
}).strict();

/** Self-service only: the authenticated actor owns the identity, never the body. */
export async function changePassword(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: z.input<typeof changePasswordSchema>,
): Promise<{ sessionVersion: number }> {
  const input = parseInput(changePasswordSchema, rawInput);
  const user = await client.user.findUnique({ where: { id: ctx.actor.userId } });
  const matches = await bcrypt.compare(input.currentPassword, user?.password ?? (await dummyHash()));
  if (!user || !user.password || !matches || user.accountStatus !== 'ACTIVE') {
    throw new ForbiddenError('Current credentials could not be verified.');
  }
  assertActorOwnsIdentity(ctx.actor, user);
  const password = await bcrypt.hash(input.newPassword, BCRYPT_COST);
  return inTransaction(client, async (tx) => {
    const moved = await tx.user.updateMany({
      where: {
        id: user.id, accountStatus: 'ACTIVE', role: user.role,
        password: user.password, sessionVersion: user.sessionVersion,
      },
      data: { password, sessionVersion: { increment: 1 } },
    });
    if (moved.count !== 1) throw new ConflictError('Credentials changed concurrently. Please sign in again.');
    await tx.invitation.updateMany({
      where: { userId: user.id, purpose: 'PASSWORD_RESET', consumedAt: null, revokedAt: null },
      data: { revokedAt: ctx.now() },
    });
    const sessionVersion = user.sessionVersion + 1;
    await appendAuditEvent(tx, {
      actorUserId: user.id,
      action: 'account.password_changed',
      subjectType: 'User',
      subjectId: user.id,
      correlationId: ctx.correlationId,
      metadata: { sessionVersion, sessionsRevoked: true },
    });
    return { sessionVersion };
  });
}

/** All password-reset writers lock User before Invitation, preventing lock-order deadlocks. */
async function lockPasswordAccount(tx: Tx, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
}

// ── Password reset (§AL/§AT) ─────────────────────────────────────────────────

export interface IssuedPasswordReset {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly rawToken: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

const requestResetSchema = z.object({ email: z.string().trim().min(3).max(320) });

/**
 * Issues a one-time reset token for an ACTIVE account with a password. Any
 * other case (unknown e-mail, PENDING/SUSPENDED/DISABLED, no password) returns
 * null so the caller answers identically — the e-mail is the only channel
 * that reveals anything. Replaces any open reset token of the account; the
 * raw token is returned ONCE for the mail layer and never logged or audited.
 */
export async function requestPasswordReset(
  client: PrismaClient,
  rawInput: z.input<typeof requestResetSchema>,
  options: { now?: () => Date; correlationId?: string } = {},
): Promise<IssuedPasswordReset | null> {
  const input = parseInput(requestResetSchema, rawInput);
  let email: string;
  try {
    email = normalizeEmail(input.email);
  } catch {
    return null;
  }
  const now = options.now ?? (() => new Date());
  const ttl = getPasswordResetTtlMs();
  return inTransaction(client, async (tx) => {
    const found = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (!found) return null;
    await lockPasswordAccount(tx, found.id);
    const user = await tx.user.findUnique({ where: { id: found.id } });
    if (!user || user.accountStatus !== 'ACTIVE' || !user.password || !user.email) return null;
    const at = now();
    await tx.invitation.updateMany({
      where: { userId: user.id, purpose: 'PASSWORD_RESET', consumedAt: null, revokedAt: null },
      data: { revokedAt: at },
    });
    const { rawToken, tokenHash } = createAccountToken('PASSWORD_RESET');
    let reset: Invitation;
    try {
      reset = await tx.invitation.create({
        data: { userId: user.id, purpose: 'PASSWORD_RESET', tokenHash, expiresAt: new Date(at.getTime() + ttl), issuedById: user.id },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError('A reset was requested concurrently for this account.', { userId: user.id });
      throw error;
    }
    await appendAuditEvent(tx, {
      actorUserId: user.id,
      action: 'account.password_reset_requested',
      subjectType: 'Invitation',
      subjectId: reset.id,
      correlationId: options.correlationId ?? reset.id,
      metadata: { userId: user.id, expiresAt: reset.expiresAt.toISOString() },
    });
    return {
      userId: user.id,
      email: user.email,
      displayName: [user.firstName, user.lastName].filter(Boolean).join(' '),
      rawToken,
      tokenHash,
      expiresAt: reset.expiresAt,
    };
  });
}

/** `true` only for an open, unexpired PASSWORD_RESET token of an ACTIVE account; never consumes anything. */
export async function inspectPasswordReset(client: PrismaClient, rawToken: string, now: () => Date = () => new Date()): Promise<boolean> {
  if (typeof rawToken !== 'string' || rawToken.length < 16 || rawToken.length > 128) return false;
  const tokenHash = accountTokenDigest(rawToken, 'PASSWORD_RESET');
  if (!tokenHash) return false;
  const reset = await client.invitation.findUnique({
    where: { tokenHash },
    include: { user: { select: { accountStatus: true } } },
  });
  if (!reset || reset.purpose !== 'PASSWORD_RESET' || reset.consumedAt || reset.revokedAt || reset.expiresAt <= now()) return false;
  return reset.user.accountStatus === 'ACTIVE';
}

const confirmResetSchema = z.object({ rawToken: z.string().min(16).max(128), newPassword: passwordSchema });

export type ConfirmPasswordResetInput = z.input<typeof confirmResetSchema>;

/**
 * Public, token-authenticated, atomic: consumes the reset token, sets the new
 * password and revokes every session of the account (sessionVersion bump).
 * Every refusal is the same NOT_FOUND / INVALID_STATE pair.
 */
export async function confirmPasswordReset(
  client: PrismaClient,
  rawInput: ConfirmPasswordResetInput,
  options: { now?: () => Date; correlationId?: string } = {},
): Promise<User> {
  const input = parseInput(confirmResetSchema, rawInput);
  const now = options.now ?? (() => new Date());
  const tokenHash = accountTokenDigest(input.rawToken, 'PASSWORD_RESET');
  if (!tokenHash) throw new NotFoundError('Reset not found or no longer valid.');
  const password = await bcrypt.hash(input.newPassword, BCRYPT_COST);

  return inTransaction(client, async (tx) => {
    const found = await tx.invitation.findUnique({ where: { tokenHash }, select: { userId: true } });
    if (!found) throw new NotFoundError('Reset link not found or no longer valid.');
    await lockPasswordAccount(tx, found.userId);
    const reset = await tx.invitation.findUnique({ where: { tokenHash } });
    if (!reset || reset.purpose !== 'PASSWORD_RESET') throw new NotFoundError('Reset link not found or no longer valid.');
    const at = now();
    if (reset.consumedAt || reset.revokedAt || reset.expiresAt <= at) {
      throw new InvalidStateError('Reset link not found or no longer valid.');
    }
    const consumed = await tx.invitation.updateMany({
      where: { id: reset.id, consumedAt: null, revokedAt: null },
      data: { consumedAt: at },
    });
    if (consumed.count !== 1) throw new InvalidStateError('Reset link not found or no longer valid.');

    const moved = await tx.user.updateMany({
      where: { id: reset.userId, accountStatus: 'ACTIVE' },
      data: { password, sessionVersion: { increment: 1 } },
    });
    if (moved.count !== 1) throw new InvalidStateError('Reset link not found or no longer valid.');

    await appendAuditEvent(tx, {
      actorUserId: reset.userId,
      action: 'account.password_reset',
      subjectType: 'User',
      subjectId: reset.userId,
      correlationId: options.correlationId ?? reset.id,
      metadata: { resetId: reset.id, sessionsRevoked: true },
    });
    return tx.user.findUniqueOrThrow({ where: { id: reset.userId } });
  });
}

export interface VerifiedCredentials {
  readonly userId: string;
  readonly role: User['role'];
  readonly sessionVersion: number;
}

// A real bcrypt hash of a random secret, compared against when no account
// matches, so the response time does not reveal whether the email exists.
// Computed on first use, not at import: this module is loaded by the live
// credentials path, and hashing at import time is both wasted work for every
// process that never authenticates and a hard crash wherever bcrypt is
// partially mocked.
let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummyHashPromise ??= bcrypt.hash(randomBytes(16).toString('hex'), BCRYPT_COST);
  return dummyHashPromise;
}

/**
 * Core v2 credential check — the future backend of NextAuth authorize(). Only
 * an ACTIVE account with a password can sign in; every other case (unknown
 * email, wrong password, PENDING/SUSPENDED/DISABLED) returns null with the
 * same timing profile, and never throws for a business reason.
 */
export async function verifyCredentials(
  client: PrismaClient,
  rawInput: { readonly email: string; readonly password: string },
): Promise<VerifiedCredentials | null> {
  let email: string;
  try {
    email = normalizeEmail(rawInput.email);
  } catch {
    return null;
  }
  if (typeof rawInput.password !== 'string' || rawInput.password.length === 0 || rawInput.password.length > 200) return null;

  const user = await client.user.findUnique({
    where: { email },
    select: { id: true, role: true, password: true, accountStatus: true, sessionVersion: true },
  });
  const hash = user?.password ?? (await dummyHash());
  const matches = await bcrypt.compare(rawInput.password, hash);
  if (!user || !user.password || !matches || user.accountStatus !== 'ACTIVE') return null;
  return { userId: user.id, role: user.role, sessionVersion: user.sessionVersion };
}

/**
 * Same check as verifyCredentials for an identity already resolved by id
 * (landing mission §8: a migrated PARENT signing in by phone). Same timing
 * profile, same refusals.
 */
export async function verifyCredentialsByUserId(
  client: PrismaClient,
  rawInput: { readonly userId: string; readonly password: string },
): Promise<VerifiedCredentials | null> {
  if (typeof rawInput.password !== 'string' || rawInput.password.length === 0 || rawInput.password.length > 200) return null;
  const user = await client.user.findUnique({
    where: { id: rawInput.userId },
    select: { id: true, role: true, password: true, accountStatus: true, sessionVersion: true },
  });
  const hash = user?.password ?? (await dummyHash());
  const matches = await bcrypt.compare(rawInput.password, hash);
  if (!user || !user.password || !matches || user.accountStatus !== 'ACTIVE') return null;
  return { userId: user.id, role: user.role, sessionVersion: user.sessionVersion };
}

/**
 * Deterministic phone resolution in Core v2 (V2_ONLY login): exactly one
 * ACTIVE PARENT carries this normalized number, or nothing. Phone is not
 * unique by design — two matches are an ambiguity, never a guess.
 */
export async function findUniqueActiveParentIdByPhone(client: PrismaClient, normalizedPhone: string): Promise<string | null> {
  const rows = await client.user.findMany({
    where: { phone: normalizedPhone, role: 'PARENT', accountStatus: 'ACTIVE' },
    select: { id: true },
    take: 2,
  });
  return rows.length === 1 ? rows[0]!.id : null;
}

/** Session claims are still valid only if the account is ACTIVE and the version matches (§X session revocation). */
export async function isSessionStillValid(
  client: PrismaClient,
  claims: { readonly userId: string; readonly role: User['role']; readonly sessionVersion: number },
): Promise<boolean> {
  const user = await client.user.findUnique({
    where: { id: claims.userId },
    select: { role: true, accountStatus: true, sessionVersion: true },
  });
  return (
    !!user &&
    user.accountStatus === 'ACTIVE' &&
    user.role === claims.role &&
    user.sessionVersion === claims.sessionVersion
  );
}
