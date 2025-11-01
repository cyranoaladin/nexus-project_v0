import { UserRole } from '@/types/enums';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';

const resolveNextAuthSecret = () => {
  const secret = process.env.NEXTAUTH_SECRET;

  if (secret && secret.length >= 32) {
    return secret;
  }

  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return 'build-time-nextauth-secret-placeholder-32chars';
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_SECRET must be configured in production and contain at least 32 characters.');
  }

  // Development/Test fallback to keep DX smooth while remaining deterministic.
  return secret ?? 'development-only-nextauth-secret-please-change';
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email
            },
            include: {
              parentProfile: true,
              studentProfile: true,
              coachProfile: true
            }
          });

          if (!user || !user.password) {
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (isPasswordValid) {
            return {
              id: user.id,
              email: user.email,
              role: user.role,
              firstName: user.firstName ?? undefined,
              lastName: user.lastName ?? undefined,
            };
          } else {
            return null;
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[AUTH][AUTHORIZE] Unexpected error', error);
          }
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      try {
        if (user) {
          token.role = user.role;
          token.firstName = user.firstName;
          token.lastName = user.lastName;
        }
        return token;
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[AUTH][JWT] Callback error', error);
        }
        return token;
      }
    },
    async session({ session, token }) {
      try {
        if (token) {
          session.user.id = token.sub!;
          session.user.role = token.role as UserRole;
          session.user.firstName = token.firstName as string;
          session.user.lastName = token.lastName as string;
        }
        return session;
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[AUTH][SESSION] Callback error', error);
        }
        // Return a basic session if there's an error
        return {
          ...session,
          user: {
            ...session.user,
            id: token?.sub || 'unknown',
            role: 'PARENT' as UserRole,
            firstName: token?.firstName as string || '',
            lastName: token?.lastName as string || ''
          }
        };
      }
    }
  },
  pages: {
    signIn: '/auth/signin'
  }
};
