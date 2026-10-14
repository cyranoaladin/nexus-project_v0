/** V1 identity leases; credentials never leave the V1 authority. No Core imports. */
import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeUserEmail } from '@/lib/contact/user-email';
import { isAccountActivationRequired } from '@/lib/auth/parent-activation';

export class V1InvitationScopeRefusal extends Error {
  constructor() { super('V1_INVITATION_SCOPE_REFUSED'); }
}
/** Infrastructure loss refuses the request but must remain retryable for workers. */
export class V1InvitationAuthorityUnavailable extends V1InvitationScopeRefusal {
  constructor() { super(); this.message = 'V1_INVITATION_AUTHORITY_UNAVAILABLE'; }
}
export interface V1InvitationIdentityContext {
  readonly issuerId: string;
  readonly targetId?: string;
  readonly recipient?: string;
  readonly targetRole?: UserRole;
  readonly expectedIssuerVersion?: number;
  readonly expectedIssuerRole?: UserRole;
  /** Only request-bound operations use cookie expiry. Workers use live identity. */
  readonly expectedSessionExpiresAt?: number;
  /** Promotion requires an existing active identity resolved solely by id. */
  readonly requireActiveTargetById?: boolean;
}
interface IdentityRow {
  id: string; email: string | null; role: UserRole; activatedAt: Date | null;
  disabledAt: Date | null; mergedIntoUserId: string | null; credentialReady: boolean; sessionVersion: number;
}
export function v1CredentialStateIsConsistent(role: UserRole, hasCredential: boolean, activatedAt: Date | null): boolean {
  return hasCredential ? !isAccountActivationRequired(role, activatedAt) : activatedAt === null;
}
/** Called INSIDE the V1 transaction that performs issuance/delivery. */
export async function assertV1InvitationIdentity(tx: Prisma.TransactionClient, input: V1InvitationIdentityContext): Promise<IdentityRow> {
  assertRequestExpiry(input);
  const rows = await tx.$queryRaw<IdentityRow[]>`
    SELECT id, email, role, "activatedAt", "disabledAt", "mergedIntoUserId", "sessionVersion", (password IS NOT NULL) AS "credentialReady"
    FROM public.users WHERE id IN (${input.issuerId}, ${input.targetId ?? input.issuerId})
      OR lower(email) = ${input.recipient ? normalizeUserEmail(input.recipient) : null}
    ORDER BY id FOR SHARE`;
  assertRequestExpiry(input);
  const issuer = rows.find(row => row.id === input.issuerId);
  if (!issuer || !issuer.credentialReady || !v1CredentialStateIsConsistent(issuer.role, true, issuer.activatedAt) || issuer.disabledAt || issuer.mergedIntoUserId
    || (input.expectedIssuerRole !== undefined && issuer.role !== input.expectedIssuerRole)
    || (input.expectedIssuerVersion !== undefined && issuer.sessionVersion !== input.expectedIssuerVersion))
    throw new V1InvitationScopeRefusal();
  if (input.targetId) {
    const byId = rows.find(row => row.id === input.targetId);
    if (input.requireActiveTargetById) {
      if (!byId || !byId.credentialReady || !v1CredentialStateIsConsistent(byId.role, true, byId.activatedAt)
        || byId.disabledAt || byId.mergedIntoUserId
        || (input.targetRole !== undefined && byId.role !== input.targetRole)
        || (input.recipient !== undefined && (!byId.email || normalizeUserEmail(byId.email) !== normalizeUserEmail(input.recipient))))
        throw new V1InvitationScopeRefusal();
      return issuer;
    }
    if (!input.recipient) throw new V1InvitationScopeRefusal();
    const emailMatches = rows.filter(row => row.email?.toLowerCase() === normalizeUserEmail(input.recipient!));
    if (emailMatches.length > 1 || (!byId && emailMatches.length !== 0)
      || (byId && (emailMatches[0]?.id !== byId.id || byId.role !== input.targetRole || byId.disabledAt || byId.mergedIntoUserId
        || !v1CredentialStateIsConsistent(byId.role, byId.credentialReady, byId.activatedAt))))
      throw new V1InvitationScopeRefusal();
  }
  return issuer;
}
function assertRequestExpiry(input: V1InvitationIdentityContext): void {
  if (input.expectedSessionExpiresAt !== undefined && (!Number.isFinite(input.expectedSessionExpiresAt)
    || input.expectedSessionExpiresAt <= Date.now())) throw new V1InvitationScopeRefusal();
}
export interface V1IdentityLease {
  readonly issuerVersion: number;
  verify(): Promise<void>;
  release(): Promise<void>;
}
/** Acquire only AFTER Core's lock; release only AFTER the Core commit/rollback. */
export async function acquireV1InvitationIdentity(input: V1InvitationIdentityContext): Promise<V1IdentityLease> {
  let held: Prisma.TransactionClient | undefined;
  let lost: unknown;
  let unlock!: () => void;
  let ready!: (version: number) => void;
  let rejectReady!: (error: unknown) => void;
  const release = new Promise<void>(resolve => { unlock = resolve; });
  const acquired = new Promise<number>((resolve, reject) => { ready = resolve; rejectReady = reject; });
  const pending = prisma.$transaction(async tx => {
    held = tx;
    await tx.$executeRawUnsafe("SET LOCAL application_name = 'nexus-v1-invitation-authority'");
    const issuer = await assertV1InvitationIdentity(tx, input);
    ready(issuer.sessionVersion);
    await release;
  }, { timeout: 15_000 });
  void pending.catch(error => { lost = error; rejectReady(error); });
  let issuerVersion: number;
  try { issuerVersion = await acquired; }
  catch (error) {
    unlock(); await pending.catch(() => undefined);
    if (error instanceof V1InvitationScopeRefusal) throw error;
    throw new V1InvitationAuthorityUnavailable();
  }
  return {
    issuerVersion,
    async verify() {
      if (lost || !held) throw new V1InvitationAuthorityUnavailable();
      try { await assertV1InvitationIdentity(held, { ...input, expectedIssuerVersion: issuerVersion }); }
      catch (error) {
        if (error instanceof V1InvitationScopeRefusal) throw error;
        throw new V1InvitationAuthorityUnavailable();
      }
      if (lost) throw new V1InvitationAuthorityUnavailable();
    },
    async release() {
      unlock();
      try { await pending; } catch { throw new V1InvitationAuthorityUnavailable(); }
    },
  };
}
