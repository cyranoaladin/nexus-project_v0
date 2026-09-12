/**
 * Credential / session authority resolution (go-live §U/§V/§S, hardened by
 * the landing mission §§7–10).
 *
 * Exactly ONE authority per identity, decided explicitly and auditably under
 * the configured rollout mode (lib/core-v2/auth/rollout.ts):
 *   - V1_ONLY : every identity is V1; Core v2 is not consulted.
 *   - HYBRID  : a Core v2 `users` row for the identity → CORE_V2 (credentials,
 *               role, account state and session version are read from Core v2
 *               only — never from Core v1, even if a v1 row also exists); no
 *               row → V1. Core v2 being missing or unreachable is NOT "V1": it
 *               is a refusal (CoreV2AuthorityUnavailableError) — fail closed.
 *   - V2_ONLY : every identity is CORE_V2; Core v1 never authenticates.
 *
 * There is no per-user fallback in either direction, and no deployment-level
 * downgrade: the mode is configuration, not a consequence of a missing URL.
 */
import { normalizeUserEmail } from '@/lib/contact/user-email';
import { requireCoreV2Client } from '../client';
import { normalizePhone } from '../contact';
import { ValidationError } from '../errors';
import { findUniqueActiveParentIdByPhone, isSessionStillValid, verifyCredentials, verifyCredentialsByUserId, type VerifiedCredentials } from '../services/account';
import { coreV1AuthEnabled, coreV2AuthEnabled, getAuthRolloutMode, type AuthRolloutMode } from './rollout';

export type CredentialAuthority = 'CORE_V2' | 'V1';

export class CoreV2AuthorityUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoreV2AuthorityUnavailableError';
  }
}

export { getAuthRolloutMode, coreV1AuthEnabled, coreV2AuthEnabled };

/** Whether a Core v2 URL is configured at all — diagnostic only; it never decides an authority (the mode does). */
export function isCoreV2AuthConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.CORE_V2_DATABASE_URL?.trim());
}
export type { AuthRolloutMode };

/** The Core v2 client, or a fail-closed refusal — never a silent "no Core v2 here". */
async function coreV2ClientOrRefuse() {
  try {
    return await requireCoreV2Client();
  } catch (error) {
    throw new CoreV2AuthorityUnavailableError(
      `Core v2 is required by ${getAuthRolloutMode()} and unavailable; refusing to authenticate. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export interface CoreV2Identity {
  readonly id: string;
  readonly email: string | null;
  readonly role: VerifiedCredentials['role'];
  readonly firstName: string | null;
  readonly lastName: string | null;
}

/** Which store owns this e-mail identity under the configured mode. */
export async function resolveCredentialAuthority(rawEmail: string): Promise<CredentialAuthority> {
  const mode = getAuthRolloutMode();
  if (mode === 'V1_ONLY') return 'V1';
  if (mode === 'V2_ONLY') return 'CORE_V2';
  const client = await coreV2ClientOrRefuse();
  const email = normalizeUserEmail(rawEmail);
  const row = await client.user.findUnique({ where: { email }, select: { id: true } });
  return row ? 'CORE_V2' : 'V1';
}

/**
 * Whether a user id is owned by Core v2 — the migrated-identity test used by
 * phone login (§8) and by session validation (§9). V1_ONLY → never; HYBRID /
 * V2_ONLY → a Core v2 row with that id; Core v2 unavailable → refusal.
 */
export async function isIdentityOwnedByCoreV2(userId: string): Promise<boolean> {
  const mode = getAuthRolloutMode();
  if (!coreV2AuthEnabled(mode)) return false;
  const client = await coreV2ClientOrRefuse();
  const row = await client.user.findUnique({ where: { id: userId }, select: { id: true } });
  return row !== null;
}

async function identityOf(client: Awaited<ReturnType<typeof requireCoreV2Client>>, verified: VerifiedCredentials): Promise<VerifiedCredentials & CoreV2Identity> {
  const user = await client.user.findUniqueOrThrow({
    where: { id: verified.userId },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  return { ...verified, id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
}

/** Core v2 password check by e-mail; null for every refusal (unknown, wrong password, not ACTIVE). */
export async function authenticateCoreV2(rawEmail: string, password: string): Promise<(VerifiedCredentials & CoreV2Identity) | null> {
  const client = await coreV2ClientOrRefuse();
  const verified = await verifyCredentials(client, { email: rawEmail, password });
  return verified ? identityOf(client, verified) : null;
}

/**
 * Core v2 password check for an identity already resolved by id (§8 option A:
 * a migrated PARENT who signs in by phone is resolved deterministically by
 * Core v1's unique-VERIFIED-phone rule, then authenticated in Core v2 only).
 */
export async function authenticateCoreV2ByUserId(userId: string, password: string): Promise<(VerifiedCredentials & CoreV2Identity) | null> {
  const client = await coreV2ClientOrRefuse();
  const verified = await verifyCredentialsByUserId(client, { userId, password });
  return verified ? identityOf(client, verified) : null;
}

/**
 * V2_ONLY phone login: Core v2 resolves the phone itself — exactly one ACTIVE
 * PARENT with that normalized number, or a refusal. Phone is not unique by
 * design, so ambiguity is never resolved by guessing.
 */
export async function authenticateCoreV2ByPhone(rawPhone: string, password: string): Promise<(VerifiedCredentials & CoreV2Identity) | null> {
  const client = await coreV2ClientOrRefuse();
  let phone: string;
  try {
    phone = normalizePhone(rawPhone);
  } catch (error) {
    if (error instanceof ValidationError) return null;
    throw error;
  }
  const userId = await findUniqueActiveParentIdByPhone(client, phone);
  if (!userId) return null;
  return authenticateCoreV2ByUserId(userId, password);
}

/** Session-claim validity against Core v2 only (ACTIVE + same role + same session version). */
export async function validateCoreV2Session(claims: { userId: string; role: VerifiedCredentials['role']; sessionVersion: number }): Promise<boolean> {
  const client = await coreV2ClientOrRefuse();
  return isSessionStillValid(client, claims);
}
