import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authConfig } from './auth.config';
import { UserRole } from '@prisma/client';
import { logger } from '@/lib/logger';
import { consumeBilanMagicLink } from '@/lib/bilans/auth/consume-magic-link';

const BILAN_MAGIC_AUTH_JS_FIELDS = new Set(['token', 'csrfToken', 'callbackUrl']);
const MAX_AUTH_JS_CSRF_TOKEN_LENGTH = 512;
const MAX_AUTH_JS_CALLBACK_URL_LENGTH = 2_048;

function isOptionalBoundedNonBlankString(
  value: unknown,
  maximumLength: number,
): boolean {
  return value === undefined
    || (typeof value === 'string'
      && value.length <= maximumLength
      && value.trim().length > 0);
}

function isSafeAuthJsCallbackUrl(value: unknown, request: Request): boolean {
  if (value === undefined) return true;
  if (
    typeof value !== 'string'
    || value.length > MAX_AUTH_JS_CALLBACK_URL_LENGTH
    || value.trim().length === 0
    || value !== value.trim()
    || value.startsWith('//')
    || value.includes('\\')
  ) {
    return false;
  }

  try {
    const requestUrl = new URL(request.url);
    const callbackUrl = new URL(value, requestUrl);
    return (requestUrl.protocol === 'https:' || requestUrl.protocol === 'http:')
      && (callbackUrl.protocol === 'https:' || callbackUrl.protocol === 'http:')
      && !callbackUrl.username
      && !callbackUrl.password
      && callbackUrl.origin === requestUrl.origin;
  } catch {
    return false;
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  // No adapter needed: Credentials-only auth with JWT strategy.
  // PrismaAdapter requires Account/Session/VerificationToken tables
  // which are not in the schema (and not needed for credentials + JWT).
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const email = credentials.email as string;
        const password = credentials.password as string;
        
        logger.info('[AUTH] Login attempt');

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            parentProfile: true,
            coachProfile: true
          }
        });

        if (!user) {
          logger.info('[AUTH] User not found');
          return null;
        }

        if (!user.password) {
          logger.info('[AUTH] User has no password set');
          return null;
        }

        // Block unactivated students
        if (user.role === UserRole.ELEVE && !user.activatedAt) {
           logger.info('[AUTH] Student account not activated');
           throw new Error("Compte élève non activé. Veuillez contacter l'administration.");
        }

        const passwordsMatch = await bcrypt.compare(password, user.password);
        
        if (passwordsMatch) {
            logger.info({ role: user.role }, '[AUTH] Login success');
            // Return user object safe for JWT
            return {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.firstName ?? undefined,
                lastName: user.lastName ?? undefined,
            };
        }
        
        logger.info('[AUTH] Password mismatch');
        return null;
      },
    }),
    Credentials({
      id: 'bilan-magic',
      name: 'Lien bilan sécurisé',
      credentials: {
        token: { label: 'Jeton', type: 'password' },
      },
      async authorize(credentials, request) {
        if (!credentials) {
          return null;
        }
        const authJsCredentials: Record<string, unknown> = credentials;
        if (
          Object.keys(authJsCredentials).some((key) => !BILAN_MAGIC_AUTH_JS_FIELDS.has(key))
          || typeof authJsCredentials.token !== 'string'
          || !isOptionalBoundedNonBlankString(
            authJsCredentials.csrfToken,
            MAX_AUTH_JS_CSRF_TOKEN_LENGTH,
          )
          || !isSafeAuthJsCallbackUrl(authJsCredentials.callbackUrl, request)
        ) {
          return null;
        }

        return consumeBilanMagicLink({
          prisma,
          rawToken: authJsCredentials.token,
        });
      },
    }),
  ],
});
