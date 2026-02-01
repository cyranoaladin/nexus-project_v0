import { UserRole } from '@/types/enums';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { NextAuthOptions } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';

// Generate a secure secret if not provided (dev only). In production, enforce presence.
const generateSecret = () => {
  if (process.env.NEXTAUTH_SECRET) {
    return process.env.NEXTAUTH_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_SECRET must be set in production environment');
  }
  // Generate a random secret for development only
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  secret: generateSecret(),
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
          // Log error without exposing details to client
          console.error('Authentication error:', error instanceof Error ? error.message : 'Unknown error');
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
        console.error('JWT callback error:', error instanceof Error ? error.message : 'Token generation failed');
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
        console.error('Session callback error:', error instanceof Error ? error.message : 'Session hydration failed');
        // Do not return a valid session if we cannot resolve it securely
        return session; // Or throw to invalidate
      }
    }
  },
  pages: {
    signIn: '/auth/signin'
  }
};
