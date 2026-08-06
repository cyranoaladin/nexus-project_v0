import {
  activationTokenMatchesPurpose,
  createActivationToken,
  hashActivationToken,
} from '@/lib/auth/activation-token'

describe('purpose-bound activation tokens', () => {
  it('uses distinct opaque domains with one canonical SHA-256 primitive', () => {
    const parent = createActivationToken('parent')
    const student = createActivationToken('student')
    expect(parent.rawToken).toMatch(/^pact_[A-Za-z0-9_-]{43}$/)
    expect(student.rawToken).toMatch(/^sact_[A-Za-z0-9_-]{43}$/)
    expect(parent.tokenHash).toBe(hashActivationToken(parent.rawToken))
    expect(student.tokenHash).toBe(hashActivationToken(student.rawToken))
    expect(activationTokenMatchesPurpose(parent.rawToken, 'student')).toBe(false)
    expect(activationTokenMatchesPurpose(student.rawToken, 'parent')).toBe(false)
  })

  it('accepts legacy opaque tokens only in the historical student domain', () => {
    expect(activationTokenMatchesPurpose('act_legacy_token', 'student')).toBe(true)
    expect(activationTokenMatchesPurpose('act_legacy_token', 'parent')).toBe(false)
  })
})
