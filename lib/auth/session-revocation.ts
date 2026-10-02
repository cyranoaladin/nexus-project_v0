import type { JWT } from 'next-auth/jwt'
import { isAccountActivationRequired } from '@/lib/auth/parent-activation'
import { prisma } from '@/lib/prisma'

type SessionUserState = {
  id: string
  role: string
  activatedAt: Date | null
  sessionVersion: number
  /** Code personnel de l'espace pédagogique (présent = compte provisionné par un opérateur). */
  pinHash?: string | null
}

export type SessionDatabase = {
  user: {
    findUnique(args: {
      where: { id: string }
      select: { id: true; role: true; activatedAt: true; sessionVersion: true; pinHash: true }
    }): Promise<SessionUserState | null>
    update(args: {
      where: { id: string }
      data: { sessionVersion: { increment: number } }
      select: { sessionVersion: true }
    }): Promise<{ sessionVersion: number }>
  }
}

function readVersion(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null
}

export async function validateSessionToken(
  token: JWT,
  database: SessionDatabase = prisma as unknown as SessionDatabase,
): Promise<JWT | null> {
  const userId = typeof token.id === 'string' && token.id.length > 0 ? token.id : null
  const role = typeof token.role === 'string' && token.role.length > 0 ? token.role : null
  const sessionVersion = readVersion(token.sessionVersion)

  // Legacy or malformed JWTs must reauthenticate. An absent version is never version zero.
  if (!userId || !role || sessionVersion === null) return null

  try {
    const user = await database.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, activatedAt: true, sessionVersion: true, pinHash: true },
    })

    if (!user || user.role !== role || user.sessionVersion !== sessionVersion) return null
    // L'activation FAMILIALE (lien d'activation, mot de passe) reste requise pour les sessions du flux email.
    // Un compte qui n'a qu'un code personnel d'espace (pas de mot de passe) ne peut avoir obtenu sa session que
    // par ce code : son activation familiale en attente n'a pas à bloquer l'espace, et n'est surtout pas consommée.
    if (isAccountActivationRequired(user.role, user.activatedAt) && !(user.role === 'ELEVE' && user.pinHash)) return null
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
