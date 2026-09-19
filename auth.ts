import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { authorizeCredentials, normalizeLoginIdentifier } from '@/lib/auth/credentials-authorize';
import { guardSensitiveRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { issueSessionToken, projectSessionClaims } from '@/lib/auth/session-claims';
import { validateSessionToken } from '@/lib/auth/session-revocation';
import { verifyServerSession } from '@/lib/auth/session-verification-outcome';

const configuredAuth = NextAuth({
  ...authConfig,
  trustHost: true,
  // No adapter needed: Credentials-only auth with JWT strategy.
  // PrismaAdapter requires Account/Session/VerificationToken tables
  // which are not in the schema (and not needed for credentials + JWT).
  session: { strategy: 'jwt' },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) return issueSessionToken(token, user);
      return validateSessionToken(token);
    },
    session({ session, token }) {
      return projectSessionClaims(session, token);
    },
  },
  providers: [
    Credentials({
      async authorize(credentials, request) {
        const blocked = await guardSensitiveRateLimit(request, {
          scope: 'credentials-login',
          identity: normalizeLoginIdentifier(credentials?.identifier ?? credentials?.email),
        });
        if (blocked) {
          // The caller gets the same opaque CredentialsSignin either way — a
          // sign-in page must not tell an attacker whether it was the password,
          // a lockout, or the limiter itself. But OPERATIONS must be able to
          // tell, and could not: a throttled login, a wrong password and a
          // rate-limit backend outage produced byte-identical evidence, so a
          // Redis failure in production would read as "every password is
          // suddenly wrong". This line is the only difference, it stays on the
          // server, and it carries no identifier.
          logger.warn(
            { status: blocked.status, reason: blocked.status === 503 ? 'BACKEND_UNAVAILABLE' : 'THROTTLED' },
            '[AUTH] Credentials sign-in refused by the rate limiter',
          );
          return null;
        }
        return authorizeCredentials(credentials);
      },
    }),
  ],
});

export const { handlers, signIn, signOut } = configuredAuth;

/** Node authority; Edge middleware deliberately retains its separate coarse JWT check. */
export async function auth() {
  return verifyServerSession(() => configuredAuth.auth());
}
