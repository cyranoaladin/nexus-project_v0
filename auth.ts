import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { authorizeCredentials, normalizeLoginIdentifier } from '@/lib/auth/credentials-authorize';
import { authorizeEspaceCredentials } from '@/lib/auth/espace-authorize';
import { normalizeUsername } from '@/lib/espace/username';
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
    // Espace pédagogique Terminale : identifiant + code personnel (élèves) ou
    // mot de passe (enseignant), sans email. Fournisseur distinct : le flux
    // email ci-dessus n'est pas modifié et n'accepte jamais un code personnel.
    Credentials({
      id: 'espace',
      name: 'Espace pédagogique',
      credentials: { username: {}, secret: {} },
      async authorize(credentials, request) {
        const blocked = await guardSensitiveRateLimit(request, {
          scope: 'espace-login',
          identity: normalizeUsername(credentials?.username),
        });
        if (blocked) {
          logger.warn(
            { status: blocked.status, reason: blocked.status === 503 ? 'BACKEND_UNAVAILABLE' : 'THROTTLED', channel: 'espace' },
            '[AUTH] Espace sign-in refused by the rate limiter',
          );
          return null;
        }
        return authorizeEspaceCredentials(credentials);
      },
    }),
  ],
});
