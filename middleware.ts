import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

const IS_E2E_MODE = process.env.E2E === '1' || process.env.NEXT_PUBLIC_E2E === '1'

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

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    // Skip rate limiting in E2E mode to avoid Edge Runtime issues
    if (!IS_E2E_MODE) {
      // Rate limiting would be applied here in production
      // Disabled for E2E tests to avoid Pino logger Edge Runtime conflicts
    }

    // Protection des routes dashboard
    if (pathname.startsWith('/dashboard')) {
      if (!token) {
        const redirectResponse = NextResponse.redirect(new URL('/auth/signin', req.url))
        return applySecurityHeaders(redirectResponse)
      }

      // Redirection automatique vers le dashboard spécifique au rôle
      if (pathname === '/dashboard' || pathname === '/dashboard/') {
        let targetPath = '/dashboard'

        switch (token.role) {
          case 'PARENT':
            targetPath = '/dashboard/parent'
            break
          case 'ELEVE':
            targetPath = '/dashboard/eleve'
            break
          case 'COACH':
            targetPath = '/dashboard/coach'
            break
          case 'ADMIN':
            targetPath = '/dashboard/admin'
            break
          case 'ASSISTANTE':
            targetPath = '/dashboard/assistante'
            break
        }

        if (targetPath !== '/dashboard') {
          const redirectResponse = NextResponse.redirect(new URL(targetPath, req.url))
          return applySecurityHeaders(redirectResponse)
        }
      }

      // Vérification des rôles spécifiques
      if (pathname.startsWith('/dashboard/eleve') && token.role !== 'ELEVE') {
        const redirectResponse = NextResponse.redirect(new URL('/dashboard', req.url))
        return applySecurityHeaders(redirectResponse)
      }

      if (pathname.startsWith('/dashboard/parent') && token.role !== 'PARENT') {
        const redirectResponse = NextResponse.redirect(new URL('/dashboard', req.url))
        return applySecurityHeaders(redirectResponse)
      }

      if (pathname.startsWith('/dashboard/coach') && token.role !== 'COACH') {
        const redirectResponse = NextResponse.redirect(new URL('/dashboard', req.url))
        return applySecurityHeaders(redirectResponse)
      }

      if (pathname.startsWith('/dashboard/assistante') && token.role !== 'ASSISTANTE') {
        const redirectResponse = NextResponse.redirect(new URL('/dashboard', req.url))
        return applySecurityHeaders(redirectResponse)
      }

      if (pathname.startsWith('/dashboard/admin') && token.role !== 'ADMIN') {
        const redirectResponse = NextResponse.redirect(new URL('/dashboard', req.url))
        return applySecurityHeaders(redirectResponse)
      }
    }

    return applySecurityHeaders(NextResponse.next())
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Permettre l'accès aux pages publiques
        if (!req.nextUrl.pathname.startsWith('/dashboard')) {
          return true
        }

        // Exiger une authentification pour les dashboards
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ]
}