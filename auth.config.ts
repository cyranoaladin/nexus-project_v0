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

      const roleDashboardMap: Record<string, string> = {
        ADMIN: '/dashboard/admin',
        ASSISTANTE: '/dashboard/assistante',
        COACH: '/dashboard/coach',
        PARENT: '/dashboard/parent',
        ELEVE: '/dashboard/eleve',
      };

      if (isOnDashboard) {
        if (!isLoggedIn) {
          return false; // Redirect unauthenticated users to login page
        }

        // Allow common authenticated dashboards
        if (nextUrl.pathname === '/dashboard' || nextUrl.pathname.startsWith('/dashboard/trajectoire')) {
          return true;
        }

        // Enforce role-based dashboard prefixes
        const rolePrefixMap: Record<string, string> = {
          ADMIN: '/dashboard/admin',
          ASSISTANTE: '/dashboard/assistante',
          COACH: '/dashboard/coach',
          PARENT: '/dashboard/parent',
          ELEVE: '/dashboard/eleve',
        };

        const expectedPrefix = role ? rolePrefixMap[role] : undefined;
        if (expectedPrefix && !nextUrl.pathname.startsWith(expectedPrefix)) {
          const fallback = roleDashboardMap[role] ?? '/dashboard';
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
