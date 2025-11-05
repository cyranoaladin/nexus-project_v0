import { UserRole } from '@/types/enums';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { NextAuthOptions } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';

const resolveNextAuthSecret = () => {
  const secret = process.env.NEXTAUTH_SECRET;

  if (secret && secret.length >= 32) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[AUTH][SECRET] Using configured NEXTAUTH_SECRET', {
        length: secret.length
      });
    }
    return secret;
  }

  // Ensure the middleware and NextAuth runtime agree on the fallback secret.
  const syncFallback = (value: string) => {
    if (process.env.NODE_ENV !== 'production') {
      const reason = secret ? 'value too short' : 'missing value';
      console.warn('[AUTH][SECRET] Using fallback NEXTAUTH_SECRET', {
        reason,
        length: value.length
      });
    }
    process.env.NEXTAUTH_SECRET = value;
    return value;
  };

  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return syncFallback('build-time-nextauth-secret-placeholder-32chars');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_SECRET must be configured in production and contain at least 32 characters.');
  }

  // Development/Test fallback to keep DX smooth while remaining deterministic.
  return syncFallback(secret ?? 'development-only-nextauth-secret-please-change');
};

const credentialsAuthorize = async (credentials?: Record<string, unknown>) => {
  if (process.env.NODE_ENV !== 'production') {
    console.info('[AUTH][AUTHORIZE] Invoked', {
      hasEmail: !!credentials?.email,
      hasPassword: !!credentials?.password
    });
  }
  if (!credentials?.email || !credentials?.password) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[AUTH][AUTHORIZE] Missing email or password in credentials payload');
    }
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        email: credentials.email as string
      },
      include: {
        parentProfile: true,
        studentProfile: true,
        coachProfile: true
      }
    });

    if (!user || !user.password) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[AUTH][AUTHORIZE] User not found or password missing', {
          email: credentials.email,
          found: !!user,
          hasPassword: !!user?.password
        });
      }
      return null;
    }

    const isPasswordValid = await bcrypt.compare(
      credentials.password as string,
      user.password
    );

    if (isPasswordValid) {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[AUTH][AUTHORIZE] Password validation succeeded', {
          email: user.email,
          role: user.role
        });
      }
      return {
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
      } satisfies {
        id: string;
        email: string;
        role: UserRole;
        firstName?: string;
        lastName?: string;
      };
    }

    if (process.env.NODE_ENV !== 'production') {
      console.warn('[AUTH][AUTHORIZE] Password validation failed', {
        email: credentials.email
      });
    }
    return null;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[AUTH][AUTHORIZE] Unexpected error', error);
    }
    return null;
  }
};

const credentialsProvider = CredentialsProvider({
  name: 'credentials',
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' }
  },
  authorize: credentialsAuthorize
});

// Ensure NextAuth calls our implementation instead of the no-op stub.
(credentialsProvider as unknown as { authorize: typeof credentialsAuthorize }).authorize = credentialsAuthorize;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  secret: resolveNextAuthSecret(),
  debug: process.env.NODE_ENV === 'development',
  providers: [credentialsProvider],
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
          if (process.env.NODE_ENV !== 'production') {
            console.info('[AUTH][JWT] Hydrating token from user', {
              sub: user.id,
              role: user.role
            });
          }
        }
        if (process.env.NODE_ENV !== 'production') {
          console.info('[AUTH][JWT] Returning token snapshot', {
            sub: token.sub,
            role: token.role,
            hasFirstName: !!token.firstName,
            hasLastName: !!token.lastName
          });
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
          if (process.env.NODE_ENV !== 'production') {
            console.info('[AUTH][SESSION] Hydrated session from token', {
              userId: session.user.id,
              role: session.user.role,
              hasFirstName: !!session.user.firstName,
              hasLastName: !!session.user.lastName
            });
          }
        }
        if (process.env.NODE_ENV !== 'production') {
          console.info('[AUTH][SESSION] Returning session snapshot', {
            userId: session.user.id,
            role: session.user.role
          });
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
