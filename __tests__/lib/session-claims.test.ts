import { issueSessionToken, projectSessionClaims } from '@/lib/auth/session-claims'
import type { DefaultSession, User } from 'next-auth'
import type { JWT } from 'next-auth/jwt'

describe('session claims', () => {
  it('copies the canonical version and identity when credentials issue a JWT', () => {
    const result = issueSessionToken({
      sub: 'user-1',
      role: 'PARENT',
      sessionVersion: 0,
    } satisfies JWT, {
      id: 'user-1',
      email: 'synthetic@example.invalid',
      role: 'PARENT',
      firstName: 'Parent',
      lastName: 'Synthetic',
      sessionVersion: 7,
    } satisfies User)

    expect(result).toEqual(expect.objectContaining({
      id: 'user-1',
      role: 'PARENT',
      sessionVersion: 7,
    }))
  })

  it('projects only the validated JWT claims into the public session', () => {
    const result = projectSessionClaims(
      {
        user: {
          id: 'user-1',
          email: 'synthetic@example.invalid',
          name: 'Synthetic',
          role: 'ELEVE',
        },
        expires: '2099-01-01T00:00:00.000Z',
      } satisfies DefaultSession,
      { id: 'user-1', role: 'ELEVE', sessionVersion: 3 } satisfies JWT,
    )

    expect(result.user).toEqual(expect.objectContaining({
      id: 'user-1',
      role: 'ELEVE',
      authority: 'V1',
    }))
  })

  it('exposes the credential authority so dashboards can pick the Core v2 view (no secret involved)', () => {
    const result = projectSessionClaims(
      { user: { id: 'user-2', email: 'synthetic@example.invalid', name: 'S', role: 'PARENT' }, expires: '2099-01-01T00:00:00.000Z' } satisfies DefaultSession,
      { id: 'user-2', role: 'PARENT', sessionVersion: 1, authority: 'CORE_V2' } satisfies JWT,
    )
    expect(result.user.authority).toBe('CORE_V2')
  })
})

test('does not expose the internal session version in the public session projection', () => {
  const projected = projectSessionClaims(
    {
      user: {
        id: 'user-private-version',
        role: 'PARENT',
        name: 'Parent Synthetic',
        email: 'parent.synthetic@example.test',
      },
      expires: '2099-01-01T00:00:00.000Z',
    },
    {
      id: 'user-private-version',
      sub: 'user-private-version',
      role: 'PARENT',
      sessionVersion: 42,
    },
  )

  expect(projected.user).not.toHaveProperty('sessionVersion')
  expect(JSON.stringify(projected)).not.toContain('sessionVersion')
  expect(JSON.stringify(projected)).not.toContain('42')
})

test('refuses to issue a JWT when the authenticated User has no valid session version', () => {
  const baseToken = { role: 'PARENT' as const }
  const baseUser = {
    id: 'user-invalid-version',
    email: 'invalid-version@example.test',
    role: 'PARENT' as const,
  }

  expect(() => issueSessionToken(baseToken, baseUser satisfies User)).toThrow('valid session version')
  expect(() => issueSessionToken(baseToken, { ...baseUser, sessionVersion: -1 } satisfies User)).toThrow('valid session version')
  expect(() => issueSessionToken(baseToken, { ...baseUser, sessionVersion: 1.5 } satisfies User)).toThrow('valid session version')
})
