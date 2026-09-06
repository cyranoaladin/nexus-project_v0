import bcrypt from 'bcryptjs'

import { isAccountActivationRequired, normalizeParentEmail } from '@/lib/auth/parent-activation'
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
  logger.info({ role: user.role }, '[AUTH] Login success')
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    sessionVersion: user.sessionVersion,
  }
}
