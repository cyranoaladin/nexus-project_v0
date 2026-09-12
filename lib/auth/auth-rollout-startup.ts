/**
 * Process-level fail-closed boundary for the auth rollout mode (landing
 * mission §10). Called from instrumentation.ts before any listener is ready:
 *   - CORE_V2_AUTH_MODE must be valid (no default);
 *   - in HYBRID / V2_ONLY the Core v2 database must be reachable AND carry the
 *     expected identity marker (requireCoreV2Client verifies both) — a
 *     production process never starts in a mode it cannot honour, so a missing
 *     or wrong CORE_V2_DATABASE_URL can never quietly turn into "everyone is V1".
 * Returns the mode so the caller can log the explicit state once.
 */
import { requireCoreV2Client } from '@/lib/core-v2/client'
import { coreV2AuthEnabled, getAuthRolloutMode, type AuthRolloutMode } from '@/lib/core-v2/auth/rollout'

export async function assertAuthRolloutStartup(): Promise<AuthRolloutMode> {
  const mode = getAuthRolloutMode()
  if (coreV2AuthEnabled(mode)) {
    // Throws CoreV2DatabaseUrlError / CoreV2DatabaseIdentityError / connection errors: all fatal here.
    await requireCoreV2Client()
  }
  return mode
}
