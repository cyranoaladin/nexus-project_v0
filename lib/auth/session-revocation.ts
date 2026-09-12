import type { JWT } from 'next-auth/jwt'
import { isAccountActivationRequired } from '@/lib/auth/parent-activation'
import { getAuthRolloutMode, isIdentityOwnedByCoreV2, validateCoreV2Session, type AuthRolloutMode } from '@/lib/core-v2/auth/authority'
import { prisma } from '@/lib/prisma'

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
    return null
  }

  if (token.authority === 'CORE_V2') {
    if (mode === 'V1_ONLY') return null
    try {
      return (await validators.coreV2({ userId, role: token.role, sessionVersion })) ? token : null
    } catch {
      return null
    }
  }

  if (mode === 'V2_ONLY') return null
  if (mode === 'HYBRID') {
    try {
      if (await validators.ownedByCoreV2(userId)) return null
    } catch {
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
    return null
  }
}

export async function revokeAllUserSessions(
  userId: string,
  database: SessionDatabase = prisma as unknown as SessionDatabase,
): Promise<{ sessionVersion: number }> {
  return database.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  })
}
