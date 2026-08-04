import { createHash, randomBytes } from 'node:crypto'

export type ActivationPurpose = 'parent' | 'student'

export type ActivationToken = Readonly<{
  rawToken: string
  tokenHash: string
  expiresAt: Date
}>

const ACTIVATION_TTL_MS = 72 * 60 * 60 * 1000
const PURPOSE_PREFIX: Record<ActivationPurpose, string> = {
  parent: 'pact_',
  student: 'sact_',
}

export function hashActivationToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export function createActivationToken(
  purpose: ActivationPurpose,
  now = new Date(),
): ActivationToken {
  const rawToken = PURPOSE_PREFIX[purpose] + randomBytes(32).toString('base64url')
  return {
    rawToken,
    tokenHash: hashActivationToken(rawToken),
    expiresAt: new Date(now.getTime() + ACTIVATION_TTL_MS),
  }
}

export function activationTokenMatchesPurpose(
  rawToken: string,
  purpose: ActivationPurpose,
): boolean {
  if (rawToken.startsWith(PURPOSE_PREFIX.parent)) return purpose === 'parent'
  if (rawToken.startsWith(PURPOSE_PREFIX.student)) return purpose === 'student'

  // Legacy activation links were issued only for students. Parent email
  // onboarding did not exist before purpose-bound tokens.
  return purpose === 'student'
}
