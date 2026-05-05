import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authConfig } from './auth.config';
import { UserRole } from '@prisma/client';
import { logger } from '@/lib/logger';

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
  ],
});
