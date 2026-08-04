import bcrypt from 'bcryptjs'

import { isAccountActivationRequired, normalizeParentEmail } from '@/lib/auth/parent-activation'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

export async function authorizeCredentials(credentials: Partial<Record<'email' | 'password', unknown>>) {
  if (typeof credentials.email !== 'string' || typeof credentials.password !== 'string') return null

  const email = normalizeParentEmail(credentials.email)
  const user = await prisma.user.findUnique({
    where: { email },
    include: { parentProfile: true, coachProfile: true },
  })
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
