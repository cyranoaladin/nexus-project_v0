import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
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

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn && isOnAuth) {
        // Redirect logged-in users away from auth pages to their dashboard
        const role = (auth.user as any).role;
        let redirectPath = '/dashboard';
        
        switch (role) {
            case 'ADMIN': redirectPath = '/dashboard/admin'; break;
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
