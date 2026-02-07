/**
 * E2E-compatible middleware
 * 
 * This version doesn't use next-auth/middleware which has Edge Runtime issues.
 * Instead, it uses basic auth checks that work in Edge Runtime.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'self'"
  ].join('; '))

  return response
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // For E2E tests, check for session cookie presence
  const hasSession = req.cookies.has('next-auth.session-token') || 
                     req.cookies.has('__Secure-next-auth.session-token')

  // Protection des routes dashboard
  if (pathname.startsWith('/dashboard')) {
    if (!hasSession) {
      const redirectResponse = NextResponse.redirect(new URL('/auth/signin', req.url))
      return applySecurityHeaders(redirectResponse)
    }
  }

  return applySecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ]
}
