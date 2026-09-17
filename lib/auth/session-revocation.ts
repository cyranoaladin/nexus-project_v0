import type { JWT } from 'next-auth/jwt'
import { isAccountActivationRequired } from '@/lib/auth/parent-activation'
import { getAuthRolloutMode, isIdentityOwnedByCoreV2, revokeCoreV2UserSessions, validateCoreV2Session, type AuthRolloutMode } from '@/lib/core-v2/auth/authority'
import { prisma } from '@/lib/prisma'
import { recordSessionVerificationUnavailable } from '@/lib/auth/session-verification-outcome'

type SessionUserState = {
  id: string
  role: string
  activatedAt: Date | null
  sessionVersion: number
}

export type SessionDatabase = {
  user: {
    findUnique(args: {
      where: { id: string }
      select: { id: true; role: true; activatedAt: true; sessionVersion: true }
    }): Promise<SessionUserState | null>
    update(args: {
      where: { id: string }
      data: { sessionVersion: { increment: number } }
      select: { sessionVersion: true }
    }): Promise<{ sessionVersion: number }>
  }
}

export type SessionValidators = {
  coreV2: typeof validateCoreV2Session
  /** Whether the identity is Core-v2-owned NOW (landing mission §9) — the current authority assignment wins over the token's claim. */
  ownedByCoreV2: typeof isIdentityOwnedByCoreV2
  mode: () => AuthRolloutMode
}

function readVersion(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null
}

/**
 * Every request re-checks the token against the store that owns the identity
 * NOW, under the configured rollout mode (go-live §U/§V, landing §§7/9):
 *   - a CORE_V2 token is validated in Core v2 only (ACTIVE, same role, same
 *     session version) and never consults Core v1; in V1_ONLY it is rejected;
 *   - a V1 token — or a legacy token issued before the claim existed — is
 *     rejected outright in V2_ONLY; in HYBRID it is rejected as soon as the
 *     identity is Core-v2-owned (a pre-migration session never survives the
 *     authority transition); otherwise it is validated in Core v1 as before.
 * Any failure, including Core v2 being unavailable, is a null token.
 */
export async function validateSessionToken(
  token: JWT,
  database: SessionDatabase = prisma as unknown as SessionDatabase,
  validators: SessionValidators = { coreV2: validateCoreV2Session, ownedByCoreV2: isIdentityOwnedByCoreV2, mode: getAuthRolloutMode },
): Promise<JWT | null> {
  const userId = typeof token.id === 'string' && token.id.length > 0 ? token.id : null
  const role = typeof token.role === 'string' && token.role.length > 0 ? token.role : null
  const sessionVersion = readVersion(token.sessionVersion)

  // Legacy or malformed JWTs must reauthenticate. An absent version is never version zero.
  if (!userId || !role || sessionVersion === null) return null

  let mode: AuthRolloutMode
  try {
    mode = validators.mode()
  } catch {
    recordSessionVerificationUnavailable()
    return null
  }

  if (token.authority === 'CORE_V2') {
    if (mode === 'V1_ONLY') return null
    try {
      return (await validators.coreV2({ userId, role: token.role, sessionVersion })) ? token : null
    } catch {
      recordSessionVerificationUnavailable()
      return null
    }
  }

  if (mode === 'V2_ONLY') return null
  if (mode === 'HYBRID') {
    try {
      if (await validators.ownedByCoreV2(userId)) return null
    } catch {
      recordSessionVerificationUnavailable()
      return null
    }
  }

  try {
    const user = await database.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, activatedAt: true, sessionVersion: true },
    })

    if (!user || user.role !== role || user.sessionVersion !== sessionVersion) return null
    if (isAccountActivationRequired(user.role, user.activatedAt)) return null
    return token
  } catch {
    recordSessionVerificationUnavailable()
    return null
  }
}

/**
 * Revoke every session for an identity, in EVERY store that can still
 * validate one.
 *
 * `validateSessionToken` routes a CORE_V2 token to Core v2 and never consults
 * Core v1. Bumping only Core v1 therefore left a migrated identity signed in
 * while this function returned success — the API answered 200 and the operator
 * believed the session was gone (`auth-client-lifecycle.spec.ts:211`, all four
 * browser projects). Revocation must be at least as broad as validation.
 *
 * Core v1 is always bumped: a V1 token may exist regardless of who owns the
 * identity now. Core v2 is bumped when it owns the identity, and a failure
 * there propagates rather than being swallowed — reporting "revoked" for a
 * session that is still live is the worse outcome.
 */
export async function revokeAllUserSessions(
  userId: string,
  database: SessionDatabase = prisma as unknown as SessionDatabase,
  authority: {
    ownedByCoreV2: typeof isIdentityOwnedByCoreV2
    revokeCoreV2: typeof revokeCoreV2UserSessions
  } = { ownedByCoreV2: isIdentityOwnedByCoreV2, revokeCoreV2: revokeCoreV2UserSessions },
): Promise<{ sessionVersion: number }> {
  const revoked = await database.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  })

  if (await authority.ownedByCoreV2(userId)) {
    await authority.revokeCoreV2(userId)
  }

  return revoked
}
