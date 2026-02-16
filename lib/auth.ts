import { UserRole } from '@/types/enums';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { NextAuthOptions } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import { logger } from '@/lib/middleware/logger';

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
          logger.warn({ event: 'auth_failed' }, 'Failed login attempt: missing credentials')
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email
            },
            include: {
              parentProfile: true,
              coachProfile: true
            }
          });

          if (!user || !user.password) {
            logger.warn({
              event: 'auth_failed',
              email: credentials.email.replace(/(?<=.{2}).*(?=@)/, '***')
            }, 'Failed login attempt: user not found')
            return null;
          }

          // Block unactivated students (Modèle B: requires activation)
          if (user.role === 'ELEVE' && !user.activatedAt) {
            logger.warn({
              event: 'auth_blocked',
              userId: user.id,
              reason: 'student_not_activated'
            }, 'Login blocked: student account not activated')
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (isPasswordValid) {
            logger.info({
              event: 'auth_success',
              userId: user.id,
              email: credentials.email.replace(/(?<=.{2}).*(?=@)/, '***')
            }, 'Successful login')
            return {
              id: user.id,
              email: user.email,
              role: user.role,
              firstName: user.firstName ?? undefined,
              lastName: user.lastName ?? undefined,
            };
          } else {
            logger.warn({
              event: 'auth_failed',
              email: credentials.email.replace(/(?<=.{2}).*(?=@)/, '***')
            }, 'Failed login attempt: invalid password')
            return null;
          }
        } catch (error) {
          logger.error({
            event: 'auth_error',
            error: error instanceof Error ? error.message : 'Unknown error',
            email: credentials?.email?.replace(/(?<=.{2}).*(?=@)/, '***')
          }, 'Authentication error')
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
          // Validate role before adding to token
          if (!user.role || !Object.values(UserRole).includes(user.role as UserRole)) {
            console.error('JWT callback: Invalid user role', { userId: user.id });
            throw new Error('Invalid user role');
          }
          token.role = user.role;
          token.firstName = user.firstName;
          token.lastName = user.lastName;
        }
        return token;
      } catch (error) {
        console.error('JWT callback error:', error instanceof Error ? error.message : 'Token generation failed');
        // Return token without role on error - will be caught in session callback
        throw error;
      }
    },
    async session({ session, token }) {
      try {
        if (!token || !token.sub) {
          throw new Error('Invalid token: missing subject');
        }

        // Validate role exists and is valid
        if (!token.role || !Object.values(UserRole).includes(token.role as UserRole)) {
          console.error('Session callback: Invalid or missing role', { userId: token.sub });
          throw new Error('Invalid session: missing or invalid role');
        }

        session.user.id = token.sub;
        session.user.role = token.role as UserRole;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;

        return session;
      } catch (error) {
        console.error('Session callback error:', error instanceof Error ? error.message : 'Session hydration failed');
        // SECURITY: Invalidate session on error by throwing
        throw error;
      }
    }
  },
  pages: {
    signIn: '/auth/signin'
  }
};
