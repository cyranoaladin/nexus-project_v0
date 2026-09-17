/**
 * Auth rollout mode (go-live §7/§10 of the landing mission) — the ONE switch
 * that says which store may authenticate anyone, read from configuration and
 * never inferred from what happens to be reachable:
 *
 *   V1_ONLY  — Core v2 authentication is disabled on purpose. Core v2 tokens
 *              are rejected. Used before the first migration.
 *   HYBRID   — both stores exist; an identity has exactly ONE authority,
 *              decided in Core v2 (row present → CORE_V2, absent → V1). Core v2
 *              is MANDATORY: if it is missing or unreachable, authentication
 *              FAILS CLOSED — nothing ever "becomes V1 again".
 *   V2_ONLY  — Core v1 credential and session authority is disabled.
 *
 * No default: a missing or invalid value is a configuration error. Production
 * startup refuses HYBRID / V2_ONLY without a verified Core v2 database identity
 * (lib/auth/auth-rollout-startup.ts).
 */
import { CoreV2ConfigError } from '../config';

export const AUTH_ROLLOUT_MODE_ENV = 'CORE_V2_AUTH_MODE';
export const AUTH_ROLLOUT_MODES = ['V1_ONLY', 'HYBRID', 'V2_ONLY'] as const;
export type AuthRolloutMode = (typeof AUTH_ROLLOUT_MODES)[number];

export function getAuthRolloutMode(env: Record<string, string | undefined> = process.env): AuthRolloutMode {
  const raw = env[AUTH_ROLLOUT_MODE_ENV]?.trim();
  if (!raw || !(AUTH_ROLLOUT_MODES as readonly string[]).includes(raw)) {
    throw new CoreV2ConfigError(
      `${AUTH_ROLLOUT_MODE_ENV} must be one of ${AUTH_ROLLOUT_MODES.join(', ')} (got ${raw ? `"${raw}"` : 'nothing'}). ` +
        'Authentication refuses to guess which store owns identities.',
    );
  }
  return raw as AuthRolloutMode;
}

/** Whether Core v2 is part of authentication at all in this mode. */
export function coreV2AuthEnabled(mode: AuthRolloutMode): boolean {
  return mode !== 'V1_ONLY';
}

/** Whether Core v1 may still authenticate anyone in this mode. */
export function coreV1AuthEnabled(mode: AuthRolloutMode): boolean {
  return mode !== 'V2_ONLY';
}
