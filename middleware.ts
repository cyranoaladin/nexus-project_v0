import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // E2E: bypass all route guards for Playwright
    if (process.env.E2E === '1' || process.env.NEXT_PUBLIC_E2E === '1') {
      return NextResponse.next();
    }
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Redirection from /dashboard to role-specific dashboard
    if (pathname === '/dashboard' && token) {
      let url = '/'; // Fallback
      switch (token.role) {
        case 'ADMIN':
          url = '/dashboard/admin';
          break;
        case 'ASSISTANTE':
          url = '/dashboard/assistante';
          break;
        case 'COACH':
          url = '/dashboard/coach';
          break;
        case 'PARENT':
          url = '/dashboard/parent';
          break;
        case 'ELEVE':
          url = '/dashboard/eleve';
          break;
      }
      return NextResponse.redirect(new URL(url, req.url));
    }

    // Role-based route protection
    if (pathname.startsWith('/dashboard/admin') && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }
    if (pathname.startsWith('/dashboard/assistante') && token?.role !== 'ASSISTANTE') {
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }
    if (pathname.startsWith('/dashboard/coach') && token?.role !== 'COACH') {
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }
    if (pathname.startsWith('/dashboard/parent') && token?.role !== 'PARENT') {
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }
    if (pathname.startsWith('/dashboard/eleve') && token?.role !== 'ELEVE') {
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) =>
        !!token || process.env.E2E === '1' || process.env.NEXT_PUBLIC_E2E === '1',
    },
  }
);

export const config = {
  // The matcher should protect all dashboard routes
  // The withAuth helper automatically excludes API routes like /api/auth
  matcher: ['/dashboard/:path*', '/session/:path*'],
};
