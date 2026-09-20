import { getRoleDestination } from '@/lib/auth/role-destinations';
import { isAdminSupervisionException } from '@/lib/auth/admin-supervision-exceptions';
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

        // Enforce role-based dashboard prefixes. This callback runs inside
        // NextAuth's real auth() wrapper before middleware.ts's own custom
        // handler — a redirect decided here fires first, so it must know
        // every exception middleware.ts knows, from the same shared source,
        // never a second copy of the rule (see admin-supervision-exceptions.ts).
        const expectedPrefix = getRoleDestination(role);
        if (
          expectedPrefix
          && !nextUrl.pathname.startsWith(expectedPrefix)
          && !isAdminSupervisionException(role, nextUrl.pathname)
        ) {
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
