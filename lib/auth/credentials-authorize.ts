import bcrypt from 'bcryptjs'

import { isAccountActivationRequired, normalizeParentEmail } from '@/lib/auth/parent-activation'
import { authenticateCoreV2, resolveCredentialAuthority } from '@/lib/core-v2/auth/authority'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { normalizeParentPhone } from '@/lib/contact/parent-phone'

export function normalizeLoginIdentifier(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 320) return null
  if (value.includes('@')) return normalizeParentEmail(value)
  try { return normalizeParentPhone(value).normalized } catch { return null }
}

export async function authorizeCredentials(credentials: Partial<Record<'identifier' | 'email' | 'password', unknown>>) {
  const identifier = normalizeLoginIdentifier(credentials.identifier ?? credentials.email)
  if (!identifier || typeof credentials.password !== 'string') return null
  const isPhone = !identifier.includes('@')

  // Go-live §U/§V: an e-mail identity has exactly one credential authority.
  // A Core v2 identity is verified in Core v2 only — its Core v1 row (if any)
  // is never consulted, and there is no fallback in either direction. Phone
  // identities stay Core v1 until Core v2 offers phone login.
  if (!isPhone && (await resolveCredentialAuthority(identifier)) === 'CORE_V2') {
    const verified = await authenticateCoreV2(identifier, credentials.password)
    if (!verified) return null
    logger.info({ role: verified.role, authority: 'CORE_V2' }, '[AUTH] Login success')
    return {
      id: verified.id,
      email: verified.email,
      role: verified.role,
      firstName: verified.firstName ?? undefined,
      lastName: verified.lastName ?? undefined,
      sessionVersion: verified.sessionVersion,
      authority: 'CORE_V2' as const,
    }
  }

  const candidates = isPhone ? await prisma.user.findMany({
    where: { phoneNormalized: identifier, role: 'PARENT', parentPhoneState: 'VERIFIED', phoneVerifiedAt: { not: null }, mergedIntoUserId: null },
    take: 2,
    include: { parentProfile: true, coachProfile: true },
  }) : []
  const user = isPhone
    ? (candidates.length === 1 ? candidates[0] : null)
    : await prisma.user.findUnique({ where: { email: identifier }, include: { parentProfile: true, coachProfile: true } })
  if (user?.mergedIntoUserId) return null
  if (isPhone && (!user || user.role !== 'PARENT' || user.parentPhoneState !== 'VERIFIED' || !user.phoneVerifiedAt)) return null
  if (!user || !user.password) return null

  if (isAccountActivationRequired(user.role, user.activatedAt)) {
    logger.info({ role: user.role }, '[AUTH] Account not activated')
    throw new Error("Compte non activé. Utilisez le lien d'activation reçu.")
  }

  if (!(await bcrypt.compare(credentials.password, user.password))) return null
  logger.info({ role: user.role, authority: 'V1' }, '[AUTH] Login success')
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    sessionVersion: user.sessionVersion,
    authority: 'V1' as const,
  }
}
