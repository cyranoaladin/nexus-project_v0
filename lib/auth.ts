import { UserRole } from '@/types/enums';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';

// Génère un secret de développement éphémère si non fourni (jamais en production)
const generateDevSecret = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const resolveNextAuthSecret = () => {
  const envSecret = process.env.NEXTAUTH_SECRET;
  const nodeEnv = process.env.NODE_ENV;
  const isNextBuildPhase = typeof process.env.NEXT_PHASE === 'string' && process.env.NEXT_PHASE.includes('phase-production-build');

  // E2E/Playwright: always use a stable, deterministic secret for both encoding/decoding
  if (process.env.PLAYWRIGHT === '1' || process.env.E2E === '1') {
    return (envSecret && envSecret.trim().length >= 32)
      ? envSecret
      : 'e2e-test-secret-0123456789abcdef0123456789ab'; // >= 32 chars
  }

  if (nodeEnv === 'production') {
    if (!envSecret || envSecret.trim().length < 32) {
      // Autoriser un secret placeholder UNIQUEMENT à la compilation (build) pour Docker
      if (isNextBuildPhase) {
        return 'build-time-placeholder-secret-0123456789abcdef0123456789ab'; // >= 32 chars
      }
      // En exécution (runtime), exigence stricte
      throw new Error('NEXTAUTH_SECRET is required in production and must be at least 32 characters.');
    }
    return envSecret;
  }
  // En développement/test: utiliser la valeur fournie si présente, sinon un secret éphémère
  return envSecret && envSecret.trim().length > 0 ? envSecret : generateDevSecret();
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  secret: resolveNextAuthSecret(),
  debug: process.env.NODE_ENV === 'development',
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (user && user.password) {
            const isPasswordValid = await bcrypt.compare(
              credentials.password,
              user.password
            );

            if (isPasswordValid) {
              return {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.firstName || undefined,
                lastName: user.lastName || undefined,
              };
            }
          }
        } catch (error) {
          console.error('[AUTHORIZE ERROR]', error);
          return null;
        }
        return null;
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;

        // Si l'utilisateur est un élève, on cherche son profil pour récupérer les IDs
        if (user.role === UserRole.ELEVE) {
          const studentProfile = await prisma.student.findUnique({
            where: { userId: user.id },
            select: { id: true, parentId: true }
          });
          if (studentProfile) {
            token.studentId = studentProfile.id;
            token.parentId = studentProfile.parentId;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        // On ajoute les IDs à la session
        session.user.studentId = token.studentId as string | null;
        session.user.parentId = token.parentId as string | null;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin'
  }
};
