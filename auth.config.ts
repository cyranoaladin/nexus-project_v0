import { getRoleDestination } from '@/lib/auth/role-destinations';
import type { NextAuthConfig } from 'next-auth';
import { issueSessionToken, projectSessionClaims } from '@/lib/auth/session-claims';

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard') || 
                          nextUrl.pathname.startsWith('/admin') ||
                          nextUrl.pathname.startsWith('/student') ||
                          nextUrl.pathname.startsWith('/parent') ||
                          nextUrl.pathname.startsWith('/coach');
      
      const role = (auth?.user as any)?.role;

      if (isOnDashboard) {
        if (!isLoggedIn) {
          return false; // Redirect unauthenticated users to login page
        }

        // Allow common authenticated dashboards
        if (nextUrl.pathname === '/dashboard' || nextUrl.pathname.startsWith('/dashboard/trajectoire')) {
          return true;
        }

        // Enforce role-based dashboard prefixes
        const expectedPrefix = getRoleDestination(role);
        if (expectedPrefix && !nextUrl.pathname.startsWith(expectedPrefix)) {
          const fallback = getRoleDestination(role) ?? '/dashboard';
          return Response.redirect(new URL(fallback, nextUrl));
        }

        return true;
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) return issueSessionToken(token, user);
      return token;
    },
    session({ session, token }) {
      return projectSessionClaims(session, token);
    },
  },
  providers: [], // Configured in auth.ts
} satisfies NextAuthConfig;
