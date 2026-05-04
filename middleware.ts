import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from './auth.config';
import { applySecurityHeaders } from '@/lib/security-headers';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  // TEMPORAIRE: désactiver le middleware pour tester /auth/signin
  const response = NextResponse.next();
  applySecurityHeaders(response);
  return response;
});

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
