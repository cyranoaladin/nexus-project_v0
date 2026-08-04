import type { DefaultSession, User } from 'next-auth'
import type { JWT } from 'next-auth/jwt'

type SessionWithClaims = Omit<DefaultSession, 'user'> & {
  user: Omit<NonNullable<DefaultSession['user']>, 'sessionVersion'> & {
    id: string
    role: User['role']
    firstName?: string | null
    lastName?: string | null
  }
}

export function issueSessionToken(token: JWT, user: User): JWT {
  const sessionVersion = user.sessionVersion
  if (!Number.isSafeInteger(sessionVersion) || sessionVersion === undefined || sessionVersion < 0) {
    throw new Error('Cannot issue a session without a valid session version')
  }

  return {
    ...token,
    id: user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    sessionVersion,
  }
}

export function projectSessionClaims(session: DefaultSession, token: JWT): SessionWithClaims {
  const { sessionVersion: _internalSessionVersion, ...publicUser } = session.user as NonNullable<DefaultSession['user']> & {
    sessionVersion?: number
  }

  return {
    ...session,
    user: {
      ...publicUser,
      id: token.id as string,
      role: token.role,
      firstName: token.firstName,
      lastName: token.lastName,
    },
  }
}
