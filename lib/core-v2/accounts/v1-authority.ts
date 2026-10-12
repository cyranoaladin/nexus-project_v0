import { CoreV2ConfigError } from '@/lib/core-v2/config';

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
  if (credentialAuthorityIsV1()) throw new CoreV2ConfigError('CORE_CREDENTIAL_WRITE_DISABLED_V1_ONLY');
}
