import { CoreV2ConfigError } from '@/lib/core-v2/config';

/**
 * Core v1 holds the credentials BY DESIGN, so a Core credential route is
 * deliberately masked — it is not a dependency outage.
 *
 * It must therefore not surface as 503: a 503 says "come back later", invites
 * retries, and (per the canonical HTTP contract) must never stand in for a
 * decision. The canonical row for a deliberately masked resource is 404, and a
 * generic one, so an already-mailed Core activation link cannot be told apart
 * from an expired or forged one.
 *
 * It keeps the `CORE_CREDENTIAL_WRITE_DISABLED_V1_ONLY` code: callers and tests
 * assert on that, and only the HTTP mapping was wrong.
 */
export class CoreV2CredentialAuthorityIsV1Error extends CoreV2ConfigError {
  constructor() {
    super('CORE_CREDENTIAL_WRITE_DISABLED_V1_ONLY');
    this.name = 'CoreV2CredentialAuthorityIsV1Error';
  }
}

/**
 * True only when the deployment EXPLICITLY declares Core v1 the sole
 * credential authority. Deliberately not `getAuthRolloutMode()`: that throws
 * on a missing mode, and the credential-writing guards below must stay inert
 * (legacy behaviour) in the HYBRID / V2_ONLY lanes and in lanes that never set
 * a mode, while still firing the moment V1_ONLY is declared.
 */
export function credentialAuthorityIsV1(env: Record<string, string | undefined> = process.env): boolean {
  return env.CORE_V2_AUTH_MODE?.trim() === 'V1_ONLY';
}

/**
 * Core v2 must never receive or store a password, a hash or a raw token while
 * Core v1 is the credential authority: a credential written into Core would be
 * a second, never-read copy. Called before ANY work (no hashing, no read, no
 * write) by every Core function that would persist one.
 */
export function assertCoreMayHoldCredentials(): void {
  if (credentialAuthorityIsV1()) throw new CoreV2CredentialAuthorityIsV1Error();
}
