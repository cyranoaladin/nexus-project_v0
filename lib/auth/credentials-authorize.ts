import bcrypt from 'bcryptjs'

import { isAccountActivationRequired, normalizeParentEmail } from '@/lib/auth/parent-activation'
import {
  authenticateCoreV2,
  authenticateCoreV2ByPhone,
  authenticateCoreV2ByUserId,
  getAuthRolloutMode,
  isIdentityOwnedByCoreV2,
  resolveCredentialAuthority,
} from '@/lib/core-v2/auth/authority'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { normalizeParentPhone } from '@/lib/contact/parent-phone'

export function normalizeLoginIdentifier(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 320) return null
  if (value.includes('@')) return normalizeParentEmail(value)
  try { return normalizeParentPhone(value).normalized } catch { return null }
}

type AuthorizedUser = {
  id: string
  email: string | null
  role: 'ADMIN' | 'ASSISTANTE' | 'COACH' | 'PARENT' | 'ELEVE'
  firstName?: string
  lastName?: string
  sessionVersion: number
  authority: 'CORE_V2' | 'V1'
}

function fromCoreV2(verified: { id: string; email: string | null; role: AuthorizedUser['role']; firstName: string | null; lastName: string | null; sessionVersion: number }): AuthorizedUser {
  logger.info({ role: verified.role, authority: 'CORE_V2' }, '[AUTH] Login success')
  return {
    id: verified.id,
    email: verified.email,
    role: verified.role,
    firstName: verified.firstName ?? undefined,
    lastName: verified.lastName ?? undefined,
    sessionVersion: verified.sessionVersion,
    authority: 'CORE_V2',
  }
}

/**
 * Go-live §U/§V, hardened by the landing mission §§7–8: the rollout mode
 * (CORE_V2_AUTH_MODE) decides which store may authenticate; an identity has
 * exactly one authority and there is no fallback in either direction.
 *
 *   V1_ONLY : Core v1 only (Core v2 never consulted).
 *   V2_ONLY : Core v2 only — e-mail verified in Core v2, phone resolved in Core v2
 *             (exactly one ACTIVE parent), Core v1 never consulted.
 *   HYBRID  : e-mail → the store that owns it (Core v2 row → CORE_V2, else V1);
 *             phone → Core v1's deterministic resolution (single VERIFIED parent),
 *             then, if that user is Core-v2-owned, the password is checked in
 *             Core v2 ONLY (§8 option A) — a migrated human never has a Core v1
 *             path by phone.
 *   Core v2 missing/unreachable in HYBRID/V2_ONLY throws (fail closed) — the
 *   caller surfaces a service refusal, never a Core v1 login.
 */
export async function authorizeCredentials(credentials: Partial<Record<'identifier' | 'email' | 'password', unknown>>): Promise<AuthorizedUser | null> {
  const identifier = normalizeLoginIdentifier(credentials.identifier ?? credentials.email)
  if (!identifier || typeof credentials.password !== 'string') return null
  const isPhone = !identifier.includes('@')
  const mode = getAuthRolloutMode()

  if (mode === 'V2_ONLY') {
    const verified = isPhone
      ? await authenticateCoreV2ByPhone(identifier, credentials.password)
      : await authenticateCoreV2(identifier, credentials.password)
    return verified ? fromCoreV2(verified) : null
  }

  if (mode === 'HYBRID' && !isPhone && (await resolveCredentialAuthority(identifier)) === 'CORE_V2') {
    const verified = await authenticateCoreV2(identifier, credentials.password)
    return verified ? fromCoreV2(verified) : null
  }

  // Core v1 resolution (V1_ONLY, or HYBRID identities Core v2 does not own).
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
  if (!user) return null

  // §8: a phone-resolved identity that Core v2 owns is authenticated in Core v2 only.
  if (mode === 'HYBRID' && isPhone && (await isIdentityOwnedByCoreV2(user.id))) {
    const verified = await authenticateCoreV2ByUserId(user.id, credentials.password)
    return verified ? fromCoreV2(verified) : null
  }

  if (!user.password) return null

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
    authority: 'V1',
  }
}
