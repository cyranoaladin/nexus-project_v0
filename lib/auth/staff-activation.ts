/**
 * Core v1 activation of a STAFF account (ASSISTANTE / COACH) from an e-mailed
 * link. Core v1 is the only credential authority: the password hash, the
 * activation timestamp and the session version are written here, in the v1
 * `users` row, and nowhere else.
 *
 * The `staff` purpose is generic. It binds a token to an audience (a staff
 * member), never to a privilege: the role is read from the row the token was
 * issued for, restricted to STAFF_ACTIVATION_ROLES, and the request carries no
 * role at all. ADMIN accounts are not activatable through this path.
 */
import bcrypt from 'bcryptjs'

import {
  activationTokenMatchesPurpose,
  hashActivationToken,
  STAFF_ACTIVATION_ROLES,
} from '@/lib/auth/activation-token'
import { hasUserEmail } from '@/lib/contact/user-email'
import { prisma } from '@/lib/prisma'
import { newPasswordSchema } from '@/lib/security/password-policy'

const INVALID_LINK = "Lien d'activation invalide ou expiré"

export type StaffActivationVerification = Readonly<{
  valid: boolean
  studentName?: string
  email?: string
  accountRole?: string
}>

export type StaffActivationCompletion = Readonly<{
  success: boolean
  error?: string
  redirectUrl?: string
}>

function displayName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim() || 'Utilisateur'
}

async function findPendingStaff(hashedToken: string) {
  const user = await prisma.user.findFirst({
    where: {
      activationToken: hashedToken,
      activationExpiry: { gt: new Date() },
      activatedAt: null,
      password: null,
      disabledAt: null,
      mergedIntoUserId: null,
      role: { in: [...STAFF_ACTIVATION_ROLES] },
    },
    select: { id: true, email: true, role: true, firstName: true, lastName: true },
  })
  if (user === null || !hasUserEmail(user.email)) return null
  return { ...user, email: user.email }
}

export async function verifyStaffActivationToken(token: string): Promise<StaffActivationVerification> {
  if (!activationTokenMatchesPurpose(token, 'staff')) return { valid: false }
  const user = await findPendingStaff(hashActivationToken(token))
  if (!user) return { valid: false }
  return {
    valid: true,
    studentName: displayName(user.firstName, user.lastName),
    email: user.email,
    accountRole: user.role,
  }
}

export async function completeStaffActivation(token: string, password: string): Promise<StaffActivationCompletion> {
  const parsed = newPasswordSchema.safeParse(password)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  if (!activationTokenMatchesPurpose(token, 'staff')) return { success: false, error: INVALID_LINK }

  const hashedToken = hashActivationToken(token)
  const user = await findPendingStaff(hashedToken)
  if (!user) return { success: false, error: INVALID_LINK }

  const passwordHash = await bcrypt.hash(password, 12)
  const activatedAt = new Date()
  const transition = await prisma.user.updateMany({
    where: {
      id: user.id,
      email: user.email,
      role: { in: [...STAFF_ACTIVATION_ROLES] },
      activationToken: hashedToken,
      activationExpiry: { gt: activatedAt },
      activatedAt: null,
      password: null,
      disabledAt: null,
      mergedIntoUserId: null,
    },
    data: {
      password: passwordHash,
      activatedAt,
      emailVerifiedAt: activatedAt,
      activationToken: null,
      activationExpiry: null,
      sessionVersion: { increment: 1 },
    },
  })
  if (transition.count !== 1) return { success: false, error: INVALID_LINK }
  return { success: true, redirectUrl: '/auth/signin?activated=true' }
}
