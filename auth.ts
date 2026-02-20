import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authConfig } from './auth.config';
import { UserRole } from '@prisma/client';

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            parentProfile: true,
            coachProfile: true
          }
        });

        if (!user || !user.password) return null;

        // Block unactivated students
        if (user.role === UserRole.ELEVE && !user.activatedAt) {
           throw new Error("Compte élève non activé. Veuillez contacter l'administration.");
        }

        const passwordsMatch = await bcrypt.compare(password, user.password);
        if (passwordsMatch) {
            // Return user object safe for JWT
            return {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.firstName ?? undefined,
                lastName: user.lastName ?? undefined,
            };
        }
        return null;
      },
    }),
  ],
});
