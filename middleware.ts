import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from './auth.config';
import { applySecurityHeaders } from '@/lib/security-headers';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const isLoggedIn = !!req.auth?.user;
  const role = (req.auth?.user as any)?.role;

  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/student') ||
    pathname.startsWith('/parent') ||
    pathname.startsWith('/coach');

  // Block unauthenticated access to protected paths
  if (isProtectedPath && !isLoggedIn) {
    const signinUrl = new URL('/auth/signin', req.nextUrl);
    signinUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(signinUrl);
  }

  // Enforce role-based dashboard access
  if (isProtectedPath && isLoggedIn) {
    const rolePrefixMap: Record<string, string> = {
      ADMIN: '/dashboard/admin',
      ASSISTANTE: '/dashboard/assistante',
      COACH: '/dashboard/coach',
      PARENT: '/dashboard/parent',
      ELEVE: '/dashboard/eleve',
    };

    // /admin/* paths are ADMIN-only
    if (pathname.startsWith('/admin') && role !== 'ADMIN') {
      const fallback = rolePrefixMap[role] ?? '/dashboard';
      return NextResponse.redirect(new URL(fallback, req.nextUrl));
    }

    // /dashboard/X paths must match user role prefix
    if (pathname.startsWith('/dashboard') &&
        pathname !== '/dashboard' &&
        !pathname.startsWith('/dashboard/trajectoire')) {
      const expectedPrefix = role ? rolePrefixMap[role] : undefined;
      if (expectedPrefix && !pathname.startsWith(expectedPrefix)) {
        return NextResponse.redirect(new URL(expectedPrefix, req.nextUrl));
      }
    }
  }

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && pathname.startsWith('/auth')) {
    const roleDashboardMap: Record<string, string> = {
      ADMIN: '/dashboard/admin',
      ASSISTANTE: '/dashboard/assistante',
      COACH: '/dashboard/coach',
      PARENT: '/dashboard/parent',
      ELEVE: '/dashboard/eleve',
    };
    const redirectPath = roleDashboardMap[role] ?? '/dashboard';
    return NextResponse.redirect(new URL(redirectPath, req.nextUrl));
  }

  const response = NextResponse.next();
  applySecurityHeaders(response);

  if (isProtectedPath) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  return response;
});

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
