import { getRoleDestination } from '@/lib/auth/role-destinations';
import NextAuth from 'next-auth';
import {
  NextResponse,
  type NextFetchEvent,
  type NextMiddleware,
  type NextRequest,
} from 'next/server';
import { authConfig } from './auth.config';
import { applySecurityHeaders } from '@/lib/security-headers';
import {
  getPreRentreeReleaseGate,
  isPreRentreeProtectedPublicPath,
} from '@/lib/campaigns/pre-rentree-2026/release-gate';
import {
  canAccessPlanningStudio,
  isPlanningStudioPath,
} from '@/lib/planning-studio/access';

const { auth } = NextAuth(authConfig);

const authenticatedMiddleware = auth((req) => {
  const pathname = req.nextUrl.pathname;
  const isLoggedIn = !!req.auth?.user;
  const role = (req.auth?.user as any)?.role;

  if (
    !getPreRentreeReleaseGate().isPublicReady
    && isPreRentreeProtectedPublicPath(pathname)
  ) {
    return new NextResponse(null, {
      status: 404,
      headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
    });
  }

  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/student') ||
    pathname.startsWith('/parent') ||
    pathname.startsWith('/coach') ||
    // Nexus Planning Studio (outil statique interne, public/planning)
    isPlanningStudioPath(pathname);

  // Block unauthenticated access to protected paths
  if (isProtectedPath && !isLoggedIn) {
    const signinUrl = new URL('/auth/signin', req.nextUrl);
    signinUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(signinUrl);
  }

  // Enforce role-based dashboard access
  if (isProtectedPath && isLoggedIn) {
    // /planning/* : direction, assistante et enseignants uniquement
    if (isPlanningStudioPath(pathname) && !canAccessPlanningStudio(role)) {
      const fallback = getRoleDestination(role) ?? '/dashboard';
      return NextResponse.redirect(new URL(fallback, req.nextUrl));
    }

    // /admin/* paths are ADMIN-only
    if (pathname.startsWith('/admin') && role !== 'ADMIN') {
      const fallback = getRoleDestination(role) ?? '/dashboard';
      return NextResponse.redirect(new URL(fallback, req.nextUrl));
    }

    // /dashboard/X paths must match user role prefix
    if (pathname.startsWith('/dashboard') &&
        pathname !== '/dashboard' &&
        !pathname.startsWith('/dashboard/trajectoire')) {
      const expectedPrefix = getRoleDestination(role);
      const isSharedCandidatePage = role === 'ADMIN'
        && /^\/dashboard\/assistante\/students\/[^/]+\/candidat\/?$/.test(pathname);
      if (expectedPrefix && !pathname.startsWith(expectedPrefix) && !isSharedCandidatePage) {
        return NextResponse.redirect(new URL(expectedPrefix, req.nextUrl));
      }
    }
  }

  const response = NextResponse.next();
  applySecurityHeaders(response);

  // La page d'arrivée famille intègre le document du bilan dans une iframe
  // MÊME ORIGINE (« Il se lit ci-dessous »). Le DENY global la laissait vide :
  // le navigateur refusait l'inclusion, le texte mentait au parent (défaut du
  // 13/08/2026). SAMEORIGIN suffit et reste fermé aux sites tiers.
  if (pathname.startsWith('/bilan/consultation/')) {
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    const csp = response.headers.get('Content-Security-Policy');
    if (csp !== null) {
      // On ne touche qu'à frame-ancestors : le reste de la politique
      // (script-src, object-src…) reste strictement celle du site.
      response.headers.set(
        'Content-Security-Policy',
        csp.replace("frame-ancestors 'none'", "frame-ancestors 'self'"),
      );
    }
  }

  if (isProtectedPath) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  return response;
}) as unknown as NextMiddleware;

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const response = await authenticatedMiddleware(request, event);
  const finalResponse = response instanceof Response ? response : NextResponse.next();

  // The Edge layer only performs a coarse JWT check. Letting it refresh a token can
  // resurrect a cookie that /api/auth/signout just deleted during concurrent navigation.
  finalResponse.headers.delete('set-cookie');
  return finalResponse;
}

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
