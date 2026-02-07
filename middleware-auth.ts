import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Middleware simplifié pour le développement local
// IMPORTANT: Le middleware complet (middleware.ts.disabled) cause des erreurs
// avec next-auth v4 + Next.js 15 Edge Runtime en mode dev.
// En production, utilisez le build qui pré-compile le middleware.

export function middleware(req: NextRequest) {
  const response = NextResponse.next()
  
  // Security headers uniquement
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ]
}
