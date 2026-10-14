/**
 * Core v1 side of an account invitation requested by Core v2 under
 * CORE_V2_AUTH_MODE=V1_ONLY.
 *
 * Core v1 is the SOLE authority for passwords, bcrypt hashes, activation
 * tokens, resets, sessions and revocations. This module is the only place
 * that issues an activation token for a Core-requested invitation, and it
 * runs entirely inside Core v1: the raw token is generated here, hashed here,
 * written into the v1 e-mail outbox here, and is never returned to the caller.
 * The Core v2 side only ever learns an outcome (a code, a v1 user id, an
 * expiry instant), never a token, a hash or a password.
 *
 * It must not import anything from lib/core-v2: it takes plain values.
 *
 * Idempotency by generation. Core numbers each invitation request with a
 * monotonic `generation`. The v1 outbox row of generation N is keyed on
 * (aggregateType 'account-invitation', aggregateId '<userId>:g<N>'):
 *   - an existing row for N  -> the issuance already happened: replay, no
 *     rotation, no second e-mail;
 *   - an existing row for M>N -> this request is stale: refused, nothing written.
 * A newer generation rotates the stored token hash, which invalidates every
 * earlier raw token of the account.
 */
import { createHash } from 'node:crypto'
import type { Prisma, UserRole } from '@prisma/client'

import { createActivationToken, type ActivationPurpose } from '@/lib/auth/activation-token'
import { buildTrustedActivationUrl } from '@/lib/auth/parent-activation'
import { normalizeUserEmail } from '@/lib/contact/user-email'
import { enqueueEmailIntentForIssuance, type EmailMessageType } from '@/lib/email/outbox'
import { escapeHtml } from '@/lib/email/templates'
import { prisma } from '@/lib/prisma'
import { assertV1InvitationIdentity, V1InvitationScopeRefusal, v1CredentialStateIsConsistent } from '@/lib/auth/v1-invitation-authority'

export const V1_INVITATION_AGGREGATE_TYPE = 'account-invitation' as const

export type V1RefusalCode =
  | 'V1_ACCOUNT_SUSPENDED'
  | 'V1_ACCOUNT_MERGED'
  | 'V1_IDENTITY_COLLISION'
  | 'V1_IDENTITY_AMBIGUOUS'
  | 'V1_ROLE_NOT_INVITABLE'
  | 'V1_GENERATION_STALE'
  | 'V1_ACCOUNT_MISSING'
  | 'V1_ISSUANCE_UNATTESTED';

export interface V1InvitationTarget {
  /** The Core v2 user id; by contract it is also the v1 user id (one id space). */
  readonly coreUserId: string;
  readonly email: string;
  /** Read from the Core row by the caller, never from a client payload. */
  readonly role: UserRole;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly phone: string | null;
  readonly generation: number;
  /** Immutable server binding, revalidated inside the V1 transaction. */
  readonly authority?: { readonly issuerId: string; readonly issuerVersion: number; readonly bindingDigest: string;
    readonly databaseIdentity: string; readonly operation: 'INVITE' | 'RESEND' };
}

export type V1IssueOutcome =
  | Readonly<{ outcome: 'ACTIVE_LINKED'; v1UserId: string }>
  | Readonly<{ outcome: 'INVITED'; v1UserId: string; expiresAt: Date; created: boolean; replayed: boolean }>
  | Readonly<{ outcome: 'REFUSED'; code: V1RefusalCode }>;

export type V1EmailDelivery = 'QUEUED' | 'SENT' | 'FAILED' | 'UNKNOWN';

export type V1AccountView =
  | Readonly<{ state: 'ACTIVE'; v1UserId: string; activatedAt: Date | null }>
  | Readonly<{ state: 'PENDING'; v1UserId: string; activationExpiry: Date | null; delivery: V1EmailDelivery }>
  | Readonly<{ state: 'REFUSED'; code: V1RefusalCode }>;

type Tx = Prisma.TransactionClient;
type Database = Pick<typeof prisma, '$transaction' | 'user' | 'jobOutbox'>;

/** A role with no activation purpose can never be invited NOR linked by the saga. */
export function isInvitableRole(role: UserRole): boolean {
  return PURPOSE_BY_ROLE[role] !== null;
}

const PURPOSE_BY_ROLE: Readonly<Record<UserRole, ActivationPurpose | null>> = {
  PARENT: 'parent',
  ELEVE: 'student',
  ASSISTANTE: 'staff',
  COACH: 'staff',
  // An administrator is never created or re-invited through an e-mailed link.
  ADMIN: null,
};
const MESSAGE_TYPE_BY_PURPOSE: Readonly<Record<ActivationPurpose, EmailMessageType>> = {
  parent: 'PARENT_ACTIVATION',
  student: 'STUDENT_ACTIVATION',
  // The outbox message type is a label only; staff reuse the non-student one,
  // exactly as lib/email/core-v2-invitation.ts already does.
  staff: 'PARENT_ACTIVATION',
};

function invitationAggregateId(userId: string, generation: number): string {
  return `${userId}:g${generation}`;
}

type V1Row = Prisma.UserGetPayload<{
  select: {
    id: true; email: true; role: true; password: true; activatedAt: true;
    activationToken: true; activationExpiry: true; disabledAt: true; mergedIntoUserId: true;
  };
}>;

const ROW_SELECT = {
  id: true, email: true, role: true, password: true, activatedAt: true,
  activationToken: true, activationExpiry: true, disabledAt: true, mergedIntoUserId: true,
} as const;

type Classification =
  | Readonly<{ kind: 'ABSENT' }>
  | Readonly<{ kind: 'ACTIVE' | 'PENDING'; row: V1Row }>
  | Readonly<{ kind: 'REFUSED'; code: V1RefusalCode }>;

/**
 * Who is this person in Core v1? Identity is the pair (id, e-mail): both must
 * designate the same v1 row, with the same role. Anything else is a collision,
 * never a guess.
 */
async function classify(tx: Tx, target: V1InvitationTarget): Promise<Classification> {
  const email = normalizeUserEmail(target.email);
  const [byId, byEmail] = await Promise.all([
    tx.user.findUnique({ where: { id: target.coreUserId }, select: ROW_SELECT }),
    tx.user.findUnique({ where: { email }, select: ROW_SELECT }),
  ]);
  if (!byId && !byEmail) return { kind: 'ABSENT' };
  if (!byId || !byEmail || byId.id !== byEmail.id) return { kind: 'REFUSED', code: 'V1_IDENTITY_COLLISION' };
  const row = byId;
  if (row.role !== target.role) return { kind: 'REFUSED', code: 'V1_IDENTITY_COLLISION' };
  if (row.mergedIntoUserId !== null) return { kind: 'REFUSED', code: 'V1_ACCOUNT_MERGED' };
  if (row.disabledAt !== null) return { kind: 'REFUSED', code: 'V1_ACCOUNT_SUSPENDED' };
  if (row.password !== null) {
    // A credential exists. For parents and students it only counts once the
    // activation timestamp agrees; a half-activated row is ambiguous.
    if (!v1CredentialStateIsConsistent(row.role, true, row.activatedAt)) return { kind: 'REFUSED', code: 'V1_IDENTITY_AMBIGUOUS' };
    return { kind: 'ACTIVE', row };
  }
  if (row.activatedAt !== null) return { kind: 'REFUSED', code: 'V1_IDENTITY_AMBIGUOUS' };
  return { kind: 'PENDING', row };
}

function invitationMessage(input: { displayName: string; rawToken: string; purpose: ActivationPurpose }) {
  const url = buildTrustedActivationUrl(input.rawToken, undefined, input.purpose).toString();
  const name = input.displayName.replace(/[\r\n<>]/g, '').trim() || 'Bonjour';
  return {
    subject: 'Activation de votre compte Nexus Réussite',
    text: [
      `Bonjour ${name},`,
      '',
      'Activez votre compte et choisissez votre mot de passe :',
      url,
      '',
      'Ce lien est personnel, temporaire et utilisable une seule fois.',
    ].join('\n'),
    html: [
      `<p>Bonjour ${escapeHtml(name)},</p>`,
      '<p>Activez votre compte et choisissez votre mot de passe :</p>',
      `<p><a href="${escapeHtml(url)}">Activer mon compte</a></p>`,
      '<p>Ce lien est personnel, temporaire et utilisable une seule fois.</p>',
    ].join(''),
  };
}

async function lockUser(tx: Tx, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
}

async function lockIssuance(tx: Tx, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`core-invitation:${userId}`}::text, 1026))::text`;
}
function receiptAuthority(target: V1InvitationTarget) {
  const authority = target.authority!;
  return { userId: target.coreUserId, generation: target.generation, databaseIdentity: authority.databaseIdentity,
    bindingDigest: authority.bindingDigest, issuerId: authority.issuerId, issuerVersion: authority.issuerVersion,
    recipientDigest: createHash('sha256').update(normalizeUserEmail(target.email)).digest('hex'),
    targetRole: target.role, operation: authority.operation };
}
function receiptMatches(receipt: Record<string, unknown>, target: V1InvitationTarget): boolean {
  return Object.entries(receiptAuthority(target)).every(([key, value]) => receipt[key] === value);
}

/**
 * Issue (or replay) the invitation of one generation, atomically: the token
 * hash, its expiry and the e-mail intent commit together or not at all.
 *
 * Active account -> read-only link; nothing at all is written. Pending
 * account -> the token is rotated. Absent account -> a pending one is created.
 * Suspended / merged / colliding / ambiguous -> refusal, no mutation.
 */
export async function issueV1AccountInvitation(
  target: V1InvitationTarget,
  options: { now?: Date; database?: Database } = {},
): Promise<V1IssueOutcome> {
  const database = options.database ?? prisma;
  const now = options.now ?? new Date();
  const purpose = PURPOSE_BY_ROLE[target.role];
  return database.$transaction(async (tx): Promise<V1IssueOutcome> => {
    if (purpose === null) return { outcome: 'REFUSED', code: 'V1_ROLE_NOT_INVITABLE' };
    if (!target.authority) return { outcome: 'REFUSED', code: 'V1_IDENTITY_AMBIGUOUS' };
    await lockIssuance(tx, target.coreUserId);
    try {
      await assertV1InvitationIdentity(tx, { issuerId: target.authority.issuerId,
        expectedIssuerVersion: target.authority.issuerVersion, targetId: target.coreUserId,
        recipient: target.email, targetRole: target.role });
    } catch (error) {
      if (error instanceof V1InvitationScopeRefusal) return { outcome: 'REFUSED', code: 'V1_IDENTITY_AMBIGUOUS' };
      throw error;
    }
    await lockUser(tx, target.coreUserId);
    const found = await classify(tx, target);
    if (found.kind === 'REFUSED') return { outcome: 'REFUSED', code: found.code };
    // A non-invitable role is refused BEFORE the ACTIVE short-circuit. The other
    // order let an ACTIVE V1 ADMIN return ACTIVE_LINKED, so the saga brought a
    // Core ADMIN actor to ACTIVE — reachable with ACCOUNT_INVITE, which
    // ASSISTANTE holds. "An administrator is never invited" must hold for
    // LINKING too, not only for creation.
    if (purpose === null) return { outcome: 'REFUSED', code: 'V1_ROLE_NOT_INVITABLE' };
    const highest = await tx.v1AccountInvitationIssuance.findFirst({ where: { userId: target.coreUserId }, orderBy: { generation: 'desc' } });
    if (highest && highest.generation > target.generation) return { outcome: 'REFUSED', code: 'V1_GENERATION_STALE' };
    if (highest?.generation === target.generation) {
      if (!receiptMatches(highest, target) || highest.revokedAt) return { outcome: 'REFUSED', code: 'V1_ISSUANCE_UNATTESTED' };
      if (found.kind === 'ACTIVE') return { outcome: 'ACTIVE_LINKED', v1UserId: found.row.id };
      if (found.kind !== 'PENDING' || highest.outcome !== 'INVITED' || highest.activationTokenHash !== found.row.activationToken
        || highest.expiresAt?.getTime() !== found.row.activationExpiry?.getTime() || !highest.expiresAt || highest.expiresAt <= now)
        return { outcome: 'REFUSED', code: 'V1_ISSUANCE_UNATTESTED' };
      return {
        outcome: 'INVITED', v1UserId: found.row.id, created: false, replayed: true,
        expiresAt: highest.expiresAt,
      };
    }
    // Never adopt legacy mail without its immutable issuance proof.
    if (await tx.jobOutbox.findFirst({ where: { aggregateType: V1_INVITATION_AGGREGATE_TYPE,
      aggregateId: invitationAggregateId(target.coreUserId, target.generation) }, select: { id: true } }))
      return { outcome: 'REFUSED', code: 'V1_ISSUANCE_UNATTESTED' };
    if (found.kind === 'ACTIVE') {
      await tx.v1AccountInvitationIssuance.create({ data: { ...receiptAuthority(target), outcome: 'ACTIVE_LINKED' } });
      return { outcome: 'ACTIVE_LINKED', v1UserId: found.row.id };
    }

    const token = createActivationToken(purpose, now);
    let v1UserId: string;
    let created = false;
    if (found.kind === 'ABSENT') {
      const email = normalizeUserEmail(target.email);
      const user = await tx.user.create({
        data: {
          id: target.coreUserId, email, role: target.role,
          firstName: target.firstName, lastName: target.lastName, phone: target.phone,
          password: null, activatedAt: null,
          activationToken: token.tokenHash, activationExpiry: token.expiresAt,
          ...(target.role === 'PARENT' ? { parentProfile: { create: {} } } : {}),
        },
        select: { id: true },
      });
      v1UserId = user.id;
      created = true;
    } else {
      const moved = await tx.user.updateMany({
        where: { id: found.row.id, password: null, activatedAt: null, disabledAt: null, mergedIntoUserId: null },
        data: { activationToken: token.tokenHash, activationExpiry: token.expiresAt },
      });
      if (moved.count !== 1) return { outcome: 'REFUSED', code: 'V1_IDENTITY_AMBIGUOUS' };
      v1UserId = found.row.id;
    }

    const displayName = [target.firstName, target.lastName].filter(Boolean).join(' ');
    const message = invitationMessage({ displayName, rawToken: token.rawToken, purpose });
    await enqueueEmailIntentForIssuance(tx, {
      aggregateId: invitationAggregateId(target.coreUserId, target.generation),
      aggregateType: V1_INVITATION_AGGREGATE_TYPE,
      messageType: MESSAGE_TYPE_BY_PURPOSE[purpose],
      issuanceId: `gen${target.generation}`,
      to: target.email,
      subject: message.subject, html: message.html, text: message.text,
      now,
    });
    const mail = await tx.jobOutbox.findFirstOrThrow({ where: { aggregateType: V1_INVITATION_AGGREGATE_TYPE,
      aggregateId: invitationAggregateId(target.coreUserId, target.generation) }, select: { id: true } });
    await tx.v1AccountInvitationIssuance.create({ data: { ...receiptAuthority(target), outcome: 'INVITED',
      activationTokenHash: token.tokenHash, expiresAt: token.expiresAt, outboxId: mail.id } });
    return { outcome: 'INVITED', v1UserId, expiresAt: token.expiresAt, created, replayed: false };
  }, { maxWait: 5_000, timeout: 20_000 });
}

/** Read-only view used by Core's saga to observe what Core v1 decided. */
export async function inspectV1Account(
  target: V1InvitationTarget,
  options: { database?: Database } = {},
): Promise<V1AccountView> {
  const database = options.database ?? prisma;
  return database.$transaction(async (tx): Promise<V1AccountView> => {
    // Même refus que sur le chemin d'émission, et pour la même raison. C'est le
    // SECOND point d'entrée de la saga : le worker appelle `inspect` dans les
    // états SENT, V1_ACTIVATED et PROVISIONING_RETRY, puis provisionne Core sur
    // un ACTIVE. Garder le refus d'un seul côté laisserait un rôle non
    // invitable atteindre ACTIVE par ce chemin si le rôle Core changeait en
    // cours de saga. « Un administrateur n'est jamais rattaché par cette saga »
    // doit valoir aux DEUX endroits qui peuvent produire un rattachement.
    if (!isInvitableRole(target.role)) return { state: 'REFUSED', code: 'V1_ROLE_NOT_INVITABLE' };
    if (!target.authority) return { state: 'REFUSED', code: 'V1_IDENTITY_AMBIGUOUS' };
    try {
      await assertV1InvitationIdentity(tx, { issuerId: target.authority.issuerId,
        expectedIssuerVersion: target.authority.issuerVersion, targetId: target.coreUserId,
        recipient: target.email, targetRole: target.role });
    } catch (error) {
      if (error instanceof V1InvitationScopeRefusal) return { state: 'REFUSED', code: 'V1_IDENTITY_AMBIGUOUS' };
      throw error;
    }
    const found = await classify(tx, target);
    if (found.kind === 'REFUSED') return { state: 'REFUSED', code: found.code };
    if (found.kind === 'ABSENT') return { state: 'REFUSED', code: 'V1_ACCOUNT_MISSING' };
    const receipt = await tx.v1AccountInvitationIssuance.findUnique({ where: { userId_generation:
      { userId: target.coreUserId, generation: target.generation } } });
    if (!receipt || !receiptMatches(receipt, target) || receipt.revokedAt)
      return { state: 'REFUSED', code: 'V1_ISSUANCE_UNATTESTED' };
    if (found.kind === 'ACTIVE') return { state: 'ACTIVE', v1UserId: found.row.id, activatedAt: found.row.activatedAt };
    if (receipt.activationTokenHash !== found.row.activationToken || receipt.expiresAt?.getTime() !== found.row.activationExpiry?.getTime())
      return { state: 'REFUSED', code: 'V1_ISSUANCE_UNATTESTED' };
    const job = await tx.jobOutbox.findFirst({
      where: {
        jobType: 'SEND_EMAIL', aggregateType: V1_INVITATION_AGGREGATE_TYPE,
        aggregateId: invitationAggregateId(target.coreUserId, target.generation),
      },
      select: { status: true },
    });
    const delivery: V1EmailDelivery = !job ? 'UNKNOWN'
      : job.status === 'COMPLETED' ? 'SENT'
        : job.status === 'FAILED_FINAL' || job.status === 'FAILED' || job.status === 'CANCELLED' ? 'FAILED'
          : 'QUEUED';
    return { state: 'PENDING', v1UserId: found.row.id, activationExpiry: found.row.activationExpiry, delivery };
  }, { maxWait: 5_000, timeout: 20_000 });
}

/**
 * Withdraws the open invitation of a generation whose Core request was
 * cancelled. Touches nothing but the pending token: an activated, suspended or
 * unknown account is left exactly as it is, and the account itself is never
 * deleted or disabled.
 */
export async function revokeV1AccountInvitation(
  input: { coreUserId: string; generation: number },
  options: { database?: Database } = {},
): Promise<{ revoked: boolean }> {
  const database = options.database ?? prisma;
  return database.$transaction(async (tx) => {
    await lockIssuance(tx, input.coreUserId);
    await lockUser(tx, input.coreUserId);
    const receipt = await tx.v1AccountInvitationIssuance.findUnique({ where: { userId_generation:
      { userId: input.coreUserId, generation: input.generation } } });
    if (!receipt || receipt.revokedAt) return { revoked: false };
    await tx.v1AccountInvitationIssuance.update({ where: { id: receipt.id }, data: { revokedAt: new Date() } });
    if (receipt.outboxId) await tx.jobOutbox.updateMany({ where: { id: receipt.outboxId,
      status: { notIn: ['COMPLETED', 'CANCELLED'] } }, data: { status: 'CANCELLED', leaseOwner: null,
        leaseExpiresAt: null, lastError: 'INVITATION_REVOKED' } });
    if (!receipt.activationTokenHash) return { revoked: false };
    const cleared = await tx.user.updateMany({
      where: {
        id: input.coreUserId, password: null, activatedAt: null,
        activationToken: receipt.activationTokenHash,
      },
      data: { activationToken: null, activationExpiry: null },
    });
    return { revoked: cleared.count === 1 };
  }, { maxWait: 5_000, timeout: 20_000 });
}
