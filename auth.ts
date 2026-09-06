import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { authorizeCredentials, normalizeLoginIdentifier } from '@/lib/auth/credentials-authorize';
import { guardSensitiveRateLimit } from '@/lib/rate-limit';
import { issueSessionToken, projectSessionClaims } from '@/lib/auth/session-claims';
import { validateSessionToken } from '@/lib/auth/session-revocation';

export const { auth, handlers, signIn, signOut } = NextAuth({
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
        if (blocked) return null;
        return authorizeCredentials(credentials);
      },
    }),
  ],
});
