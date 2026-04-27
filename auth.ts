import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authConfig } from './auth.config';
import { UserRole } from '@prisma/client';

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
        
        console.log(`[AUTH] Attempt for email: ${email}`);

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            parentProfile: true,
            coachProfile: true
          }
        });

        if (!user) {
          console.log(`[AUTH] User not found: ${email}`);
          return null;
        }

        if (!user.password) {
          console.log(`[AUTH] User has no password set: ${email}`);
          return null;
        }

        // Block unactivated students
        if (user.role === UserRole.ELEVE && !user.activatedAt) {
           console.log(`[AUTH] Student account not activated: ${email}`);
           throw new Error("Compte élève non activé. Veuillez contacter l'administration.");
        }

        const passwordsMatch = await bcrypt.compare(password, user.password);
        
        if (passwordsMatch) {
            console.log(`[AUTH] Success for: ${email} (${user.role})`);
            // Return user object safe for JWT
            return {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.firstName ?? undefined,
                lastName: user.lastName ?? undefined,
            };
        }
        
        console.log(`[AUTH] Password mismatch for: ${email}`);
        return null;
      },
    }),
  ],
});
