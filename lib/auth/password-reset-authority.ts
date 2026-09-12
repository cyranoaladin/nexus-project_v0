/**
 * Password-reset bridge (go-live §U/§V/§AL): the public "mot de passe oublié"
 * form does not know which store owns an e-mail. This resolves the credential
 * authority exactly like login does and, for a CORE_V2 identity, issues the
 * reset through Core v2 (token hashed at rest, one open reset per account,
 * mail via the canonical outbox). A V1 identity is left to the Core v1 flow —
 * the caller continues — and there is no fallback in either direction; the
 * rollout mode (CORE_V2_AUTH_MODE) is the only switch, never a missing URL.
 * Returns the same shape for "issued" and "nothing to do": the HTTP layer
 * answers identically either way (no enumeration).
 */
import { getAuthRolloutMode, resolveCredentialAuthority } from '@/lib/core-v2/auth/authority';
import { requireCoreV2Client } from '@/lib/core-v2/client';
import { requestPasswordReset } from '@/lib/core-v2/services/account';
import { deliverCoreV2PasswordReset } from '@/lib/email/core-v2-password-reset';

export type PasswordResetAuthorityOutcome = 'V1' | 'CORE_V2_ISSUED' | 'CORE_V2_NOT_ELIGIBLE';

export async function requestPasswordResetByAuthority(email: string, options: { correlationId?: string } = {}): Promise<PasswordResetAuthorityOutcome> {
  // The rollout mode decides (landing mission §§7/19): V1_ONLY never opens Core v2; V2_ONLY never
  // falls back to Core v1; HYBRID asks Core v2 who owns the e-mail — and refuses if Core v2 is unavailable.
  const mode = getAuthRolloutMode();
  if (mode === 'V1_ONLY') return 'V1';
  if (mode === 'HYBRID' && (await resolveCredentialAuthority(email)) !== 'CORE_V2') return 'V1';
  const client = await requireCoreV2Client();
  const issued = await requestPasswordReset(client, { email }, { correlationId: options.correlationId });
  if (!issued) return 'CORE_V2_NOT_ELIGIBLE';
  await deliverCoreV2PasswordReset({
    userId: issued.userId,
    email: issued.email,
    displayName: issued.displayName,
    rawToken: issued.rawToken,
    tokenHash: issued.tokenHash,
    expiresAt: issued.expiresAt,
  });
  return 'CORE_V2_ISSUED';
}
