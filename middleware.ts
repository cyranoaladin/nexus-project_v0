import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { RateLimitPresets } from '@/lib/middleware/rateLimit'

function logSecurityEvent(event: string, data: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[Security]', event, JSON.stringify(data));
  }
}

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
    // Bypass middleware for E2E tests
    if (process.env.DISABLE_MIDDLEWARE === 'true') {
      return NextResponse.next();
    }

    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    // Rate limiting for authentication endpoint
    if (pathname === '/api/auth/callback/credentials') {
      const rateLimitResult = RateLimitPresets.auth(req, 'auth:login')

      if (rateLimitResult) {
        const forwarded = req.headers.get('x-forwarded-for')
        const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown'

        logSecurityEvent('rate_limit_exceeded', {
          ip,
          path: pathname,
          attempt: 'login',
          statusCode: 429,
        })

        return applySecurityHeaders(rateLimitResult)
      }
    }

    // Rate limiting for ARIA endpoints
    if (pathname.startsWith('/api/aria/')) {
      let rateLimitResult = null

      if (pathname === '/api/aria/chat') {
        rateLimitResult = RateLimitPresets.expensive(req, 'aria:chat')
      } else if (pathname === '/api/aria/feedback') {
        rateLimitResult = RateLimitPresets.api(req, 'aria:feedback')
      }

      if (rateLimitResult) {
        const forwarded = req.headers.get('x-forwarded-for')
        const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown'

        logSecurityEvent('rate_limit_exceeded', {
          ip,
          path: pathname,
          userId: token?.sub,
          statusCode: 429,
        })

        return applySecurityHeaders(rateLimitResult)
      }
    }

    // Protection des routes dashboard
    if (pathname.startsWith('/dashboard')) {
      if (!token) {
        const redirectResponse = NextResponse.redirect(new URL('/auth/signin', req.url))
        return applySecurityHeaders(redirectResponse)
      }

      // Vérification des rôles spécifiques
      if (pathname.startsWith('/dashboard/eleve') && token.role !== 'ELEVE') {
        const redirectResponse = NextResponse.redirect(new URL('/dashboard', req.url))
        return applySecurityHeaders(redirectResponse)
      }

      if (pathname.startsWith('/dashboard/student') && token.role !== 'ELEVE') {
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
        // Bypass auth for E2E tests
        if (process.env.DISABLE_MIDDLEWARE === 'true') {
          return true;
        }

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
