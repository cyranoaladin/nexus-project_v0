/**
 * Credential / session authority resolution (go-live §U/§V/§S).
 *
 * Exactly ONE authority per identity, decided explicitly and auditably:
 *   - a Core v2 `users` row exists for the normalized e-mail  →  CORE_V2
 *     (credentials, role, account state and session version are read from
 *     Core v2 only — never from Core v1, even if a v1 row also exists);
 *   - no Core v2 row                                             →  V1
 *     (the not-yet-migrated population, temporary by design).
 *
 * There is no per-user fallback in either direction: a CORE_V2 identity whose
 * Core v2 lookup fails does not "try v1", it fails closed. The only
 * deployment-level switch is configuration: without CORE_V2_DATABASE_URL the
 * deployment has no Core v2 at all and every identity is V1 — an explicit
 * state, logged once, not a silent fallback.
 */
import { CoreV2DatabaseUrlError, requireCoreV2Client } from '../client';
import { normalizeUserEmail } from '@/lib/contact/user-email';
import { isSessionStillValid, verifyCredentials, type VerifiedCredentials } from '../services/account';

export type CredentialAuthority = 'CORE_V2' | 'V1';

export class CoreV2AuthorityUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoreV2AuthorityUnavailableError';
  }
}

export function isCoreV2AuthConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.CORE_V2_DATABASE_URL?.trim());
}

export interface CoreV2Identity {
  readonly id: string;
  readonly email: string;
  readonly role: VerifiedCredentials['role'];
  readonly firstName: string | null;
  readonly lastName: string | null;
}

/** Which store owns this e-mail identity. Fails closed if Core v2 is configured but unreachable. */
export async function resolveCredentialAuthority(rawEmail: string): Promise<CredentialAuthority> {
  if (!isCoreV2AuthConfigured()) return 'V1';
  const email = normalizeUserEmail(rawEmail);
  let client;
  try {
    client = await requireCoreV2Client();
  } catch (error) {
    if (error instanceof CoreV2DatabaseUrlError) return 'V1';
    throw new CoreV2AuthorityUnavailableError(
      `Core v2 is configured but unavailable; refusing to decide credential authority. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const row = await client.user.findUnique({ where: { email }, select: { id: true } });
  return row ? 'CORE_V2' : 'V1';
}

/** Core v2 password check; null for every refusal (unknown, wrong password, not ACTIVE). */
export async function authenticateCoreV2(rawEmail: string, password: string): Promise<(VerifiedCredentials & CoreV2Identity) | null> {
  const client = await requireCoreV2Client();
  const verified = await verifyCredentials(client, { email: rawEmail, password });
  if (!verified) return null;
  const user = await client.user.findUniqueOrThrow({
    where: { id: verified.userId },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  return { ...verified, id: user.id, email: user.email as string, firstName: user.firstName, lastName: user.lastName };
}

/** Session-claim validity against Core v2 only (ACTIVE + same role + same session version). */
export async function validateCoreV2Session(claims: { userId: string; role: VerifiedCredentials['role']; sessionVersion: number }): Promise<boolean> {
  const client = await requireCoreV2Client();
  return isSessionStillValid(client, claims);
}
