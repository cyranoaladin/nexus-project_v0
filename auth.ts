import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authConfig } from './auth.config';
import { UserRole } from '@prisma/client';
import {
  isLockedOut,
  recordFailedAttempt,
  clearFailedAttempts,
  applyDelay,
} from '@/lib/auth-lockout';

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  // No adapter needed: Credentials-only auth with JWT strategy.
  // PrismaAdapter requires Account/Session/VerificationToken tables
  // which are not in the schema (and not needed for credentials + JWT).
  session: { strategy: 'jwt' },
  
  // Explicit cookie security configuration (P1-AUTH-001 fix)
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  
  // Trust host header when behind reverse proxy (production)
  trustHost: true,
  
  // Secret rotation: See docs/JWT_SECRET_ROTATION.md for rotation procedure
  // Current implementation uses NEXTAUTH_SECRET (manual rotation every 90 days recommended)
  providers: [
    Credentials({
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const email = credentials.email as string;
        const password = credentials.password as string;

        // Check if account is locked out
        const locked = await isLockedOut(email);
        if (locked) {
          throw new Error("Trop de tentatives de connexion échouées. Votre compte est temporairement verrouillé. Réessayez dans 15 minutes.");
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            parentProfile: true,
            coachProfile: true
          }
        });

        if (!user || !user.password) {
          // Record failed attempt (user not found)
          await recordFailedAttempt(email);
          return null;
        }

        // Block unactivated students
        if (user.role === UserRole.ELEVE && !user.activatedAt) {
           throw new Error("Compte élève non activé. Veuillez contacter l'administration.");
        }

        const passwordsMatch = await bcrypt.compare(password, user.password);
        if (passwordsMatch) {
            // Clear failed attempts on successful login
            await clearFailedAttempts(email);
            
            // Return user object safe for JWT
            return {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.firstName ?? undefined,
                lastName: user.lastName ?? undefined,
            };
        }
        
        // Password mismatch - record failed attempt
        const { shouldDelay } = await recordFailedAttempt(email);
        
        // Apply delay if threshold reached (5+ attempts)
        if (shouldDelay) {
          await applyDelay();
        }
        
        return null;
      },
    }),
  ],
});
