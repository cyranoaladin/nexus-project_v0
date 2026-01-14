import { UserRole } from '@/types/enums';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { NextAuthOptions } from 'next-auth';
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
  adapter: PrismaAdapter(prisma) as any,
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
        // === LOG DE DÉBOGAGE N°1 ===
        console.log("--- [AUTHORIZE START] ---");
        console.log("Credentials received:", credentials);

        if (!credentials?.email || !credentials?.password) {
          console.error("[AUTHORIZE ERROR] Missing credentials");
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

          // === LOG DE DÉBOGAGE N°2 ===
          console.log("User found in DB:", user);

          if (!user || !user.password) {
            console.error("[AUTHORIZE ERROR] User not found or no password set");
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          // === LOG DE DÉBOGAGE N°3 ===
          console.log("Is password valid:", isPasswordValid);

          if (isPasswordValid) {
            console.log("--- [AUTHORIZE SUCCESS] ---");
            return {
              id: user.id,
              email: user.email,
              role: user.role,
              firstName: user.firstName ?? undefined,
              lastName: user.lastName ?? undefined,
            };
          } else {
            console.error("[AUTHORIZE ERROR] Invalid password");
            return null;
          }
        } catch (error) {
          // === LOG DE DÉBOGAGE N°4 ===
          console.error("--- [AUTHORIZE CATCH ERROR] ---", error);
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
      // === LOG DE DÉBOGAGE N°5 ===
      console.log("--- [JWT CALLBACK] ---", { token, user });
      try {
        if (user) {
          token.role = user.role;
          token.firstName = user.firstName;
          token.lastName = user.lastName;
        }
        return token;
      } catch (error) {
        console.error('JWT callback error:', error);
        return token;
      }
    },
    async session({ session, token }) {
      // === LOG DE DÉBOGAGE N°6 ===
      console.log("--- [SESSION CALLBACK] ---", { session, token });
      try {
        if (token) {
          session.user.id = token.sub!;
          session.user.role = token.role as UserRole;
          session.user.firstName = token.firstName as string;
          session.user.lastName = token.lastName as string;
        }
        return session;
      } catch (error) {
        console.error('Session callback error:', error);
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
