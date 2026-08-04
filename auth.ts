import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { authorizeCredentials } from '@/lib/auth/credentials-authorize';
import { guardRateLimitAsync } from '@/lib/rate-limit';

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  // No adapter needed: Credentials-only auth with JWT strategy.
  // PrismaAdapter requires Account/Session/VerificationToken tables
  // which are not in the schema (and not needed for credentials + JWT).
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      async authorize(credentials, request) {
        const blocked = await guardRateLimitAsync(request, {
          preset: 'auth',
          keySuffix: 'credentials-login',
        });
        if (blocked) return null;
        return authorizeCredentials(credentials);
      },
    }),
  ],
});
