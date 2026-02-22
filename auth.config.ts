import type { NextAuthConfig } from 'next-auth';

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
      
      const isOnAuth = nextUrl.pathname.startsWith('/auth');
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
      } else if (isLoggedIn && isOnAuth) {
        // Redirect logged-in users away from auth pages to their dashboard
        let redirectPath = '/dashboard';
        
        switch (role) {
            case 'ADMIN': redirectPath = '/dashboard/admin'; break;
            case 'ASSISTANTE': redirectPath = '/dashboard/assistante'; break;
            case 'COACH': redirectPath = '/dashboard/coach'; break;
            case 'PARENT': redirectPath = '/dashboard/parent'; break;
            case 'ELEVE': redirectPath = '/dashboard/eleve'; break;
        }

        return Response.redirect(new URL(redirectPath, nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as any;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
      }
      return session;
    },
  },
  providers: [], // Configured in auth.ts
} satisfies NextAuthConfig;
