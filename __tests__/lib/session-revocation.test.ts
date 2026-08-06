import {
  revokeAllUserSessions,
  validateSessionToken,
} from '@/lib/auth/session-revocation'
import type { JWT } from 'next-auth/jwt'

function token(overrides: Record<string, unknown> = {}): JWT {
  return {
    id: 'user-1',
    role: 'PARENT',
    sessionVersion: 0,
    email: 'synthetic@example.test',
    ...overrides,
  } as JWT
}

function database(user: Record<string, unknown> | null) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue({ sessionVersion: 1 }),
    },
  }
}

describe('versioned JWT session validation', () => {
  const activeParent = {
    id: 'user-1',
    role: 'PARENT',
    activatedAt: new Date('2026-08-04T00:00:00Z'),
    sessionVersion: 0,
  }

  it('accepts only a current, role-consistent and active session', async () => {
    const db = database(activeParent)
    const current = token()

    await expect(validateSessionToken(current, db)).resolves.toBe(current)
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, role: true, activatedAt: true, sessionVersion: true },
    })
  })

  it.each([
    ['legacy versionless token', token({ sessionVersion: undefined })],
    ['non-integer version', token({ sessionVersion: '0' })],
    ['negative version', token({ sessionVersion: -1 })],
    ['missing user id', token({ id: undefined })],
    ['missing role', token({ role: undefined })],
  ])('refuses %s before database access', async (_label, candidate) => {
    const db = database(activeParent)
    await expect(validateSessionToken(candidate, db)).resolves.toBeNull()
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })

  it.each([
    ['deleted User', null],
    ['changed role', { ...activeParent, role: 'ELEVE' }],
    ['revoked activation', { ...activeParent, activatedAt: null }],
    ['stale version', { ...activeParent, sessionVersion: 1 }],
    ['future token version', { ...activeParent, sessionVersion: -1 }],
  ])('refuses a token after %s', async (_label, currentUser) => {
    await expect(validateSessionToken(token(), database(currentUser))).resolves.toBeNull()
  })

  it('keeps historical staff roles independent from activatedAt', async () => {
    const db = database({ ...activeParent, role: 'ADMIN', activatedAt: null })
    await expect(validateSessionToken(token({ role: 'ADMIN' }), db)).resolves.not.toBeNull()
  })

  it('fails closed when PostgreSQL is unavailable', async () => {
    const db = database(activeParent)
    db.user.findUnique.mockRejectedValueOnce(new Error('database unavailable'))
    await expect(validateSessionToken(token(), db)).resolves.toBeNull()
  })

  it('increments the version atomically and never resets it', async () => {
    const db = database(activeParent)
    await revokeAllUserSessions('user-1', db)
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    })
  })
})
