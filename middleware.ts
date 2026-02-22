import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from './auth.config';
import { applySecurityHeaders } from '@/lib/security-headers';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const response = NextResponse.next();
  applySecurityHeaders(response);

  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  return response;
});

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
