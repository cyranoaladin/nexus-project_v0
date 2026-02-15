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
  // NOTE: 'unsafe-inline' required by style jsx (stages, academies pages)
  // TODO: Migrate to CSS modules/Tailwind to remove unsafe-inline
  const isDev = process.env.NODE_ENV !== 'production';
  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "connect-src 'self' https://api.openai.com https://api.konnect.network https://fonts.googleapis.com",
    "frame-src 'self' https://meet.jit.si https://*.jitsi.net",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '))

  return response
}

export default withAuth(
  function middleware(req) {
    // Bypass middleware for E2E tests (NEVER in production)
    const shouldBypass =
      (process.env.DISABLE_MIDDLEWARE === 'true' || process.env.SKIP_MIDDLEWARE === 'true') &&
      process.env.NODE_ENV !== 'production';
    if (shouldBypass) {
      return NextResponse.next();
    }

    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    if (pathname.startsWith('/api/programme/maths-1ere/progress') && !token) {
      return applySecurityHeaders(
        NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      );
    }

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
      // Role-based access control: redirect to the correct dashboard for the user's role
      const roleRouteMap: Record<string, string> = {
        ELEVE: '/dashboard/eleve',
        PARENT: '/dashboard/parent',
        COACH: '/dashboard/coach',
        ASSISTANTE: '/dashboard/assistante',
        ADMIN: '/dashboard/admin',
      }

      const rolePrefixMap: Record<string, string[]> = {
        ELEVE: ['/dashboard/eleve', '/dashboard/student'],
        PARENT: ['/dashboard/parent'],
        COACH: ['/dashboard/coach'],
        ASSISTANTE: ['/dashboard/assistante'],
        ADMIN: ['/dashboard/admin'],
      }

      // If user is on /dashboard exactly, redirect to their role's dashboard
      if (pathname === '/dashboard' || pathname === '/dashboard/') {
        const userRole = token.role as string
        const targetRoute = roleRouteMap[userRole] || '/auth/signin'
        const redirectResponse = NextResponse.redirect(new URL(targetRoute, req.url))
        return applySecurityHeaders(redirectResponse)
      }

      // Check if user is accessing a dashboard they don't have permission for
      const userRole = token.role as string
      const allowedPrefixes = rolePrefixMap[userRole] || []
      const isAccessingOtherDashboard = Object.values(rolePrefixMap)
        .flat()
        .some(prefix => pathname.startsWith(prefix))

      if (isAccessingOtherDashboard && !allowedPrefixes.some(prefix => pathname.startsWith(prefix))) {
        // ADMIN can access all dashboards
        if (userRole !== 'ADMIN') {
          const targetRoute = roleRouteMap[userRole] || '/auth/signin'
          const redirectResponse = NextResponse.redirect(new URL(targetRoute, req.url))
          return applySecurityHeaders(redirectResponse)
        }
      }
    }

    return applySecurityHeaders(NextResponse.next())
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Bypass auth for E2E tests (NEVER in production)
        const shouldBypass =
          (process.env.DISABLE_MIDDLEWARE === 'true' || process.env.SKIP_MIDDLEWARE === 'true') &&
          process.env.NODE_ENV !== 'production';
        if (shouldBypass) {
          return true;
        }

        if (req.nextUrl.pathname.startsWith('/api/programme/maths-1ere/progress')) {
          return !!token;
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
