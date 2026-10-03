/**
 * CSRF Protection Utility
 *
 * Validates that mutating requests (POST, PUT, DELETE, PATCH) originate
 * from the same origin as the application by checking the Origin or Referer header.
 *
 * This is a lightweight alternative to token-based CSRF for API routes
 * that are called via fetch() from the same-origin frontend.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */

import { NextRequest, NextResponse } from 'next/server';

/** Allowed origins for CSRF validation */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  // Production domain
  origins.push('https://nexusreussite.academy');

  // NEXT_PUBLIC_APP_URL if set
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  }

  // NEXTAUTH_URL if set
  if (process.env.NEXTAUTH_URL) {
    origins.push(process.env.NEXTAUTH_URL);
  }

  // Dev origins
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000');
    origins.push('http://localhost:3001');
    origins.push('http://localhost:3011');
    origins.push('http://127.0.0.1:3000');
    origins.push('http://127.0.0.1:3001');
  }

  return origins.map(extractOrigin).filter((origin): origin is string => origin !== null);
}

/**
 * Extract the origin from a URL string.
 * Returns protocol + host (no path).
 */
function extractOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Check CSRF protection on a request.
 *
 * Returns null if the request is valid (same-origin).
 * Returns a 403 NextResponse if the request fails CSRF validation.
 *
 * Only checks mutating methods (POST, PUT, DELETE, PATCH).
 * GET/HEAD/OPTIONS are always allowed.
 *
 * @param request - The incoming NextRequest
 * @returns null if valid, NextResponse 403 if rejected
 */
export function checkCsrf(request: NextRequest): NextResponse | null {
  // Only check mutating methods
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return null;
  }

  // Skip in test environment
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // If neither Origin nor Referer is present, reject
  // (except for server-to-server calls which won't have these)
  const sourceOrigin = origin || (referer ? extractOrigin(referer) : null);

  if (!sourceOrigin) {
    // Allow requests without Origin/Referer in dev (e.g., curl, Postman)
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }
    // In production, log and reject
    return NextResponse.json(
      { error: 'Forbidden — missing origin' },
      { status: 403 }
    );
  }

  const allowedOrigins = getAllowedOrigins();

  // The trust boundary is configuration, never request-controlled Host or
  // X-Forwarded-Host. Origin headers contain only an origin; Referer may
  // contain a path and has already been reduced above.
  const sourceUrl = extractOrigin(sourceOrigin);
  const validSource = sourceUrl !== null && sourceOrigin === sourceUrl;
  const localDevelopmentOrigin = process.env.NODE_ENV === 'development'
    && sourceUrl !== null && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(sourceUrl);
  const isAllowed = validSource && (localDevelopmentOrigin || allowedOrigins.includes(sourceUrl));

  if (!isAllowed) {
    return NextResponse.json(
      { error: 'Forbidden — cross-origin request' },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Maximum allowed request body size in bytes.
 * Default: 1MB. Prevents oversized payloads from consuming memory.
 */
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB

/**
 * Check Content-Length header against maximum allowed size.
 *
 * @param request - The incoming NextRequest
 * @param maxBytes - Maximum allowed body size (default 1MB)
 * @returns null if valid, NextResponse 413 if too large
 */
export function checkBodySize(
  request: NextRequest,
  maxBytes: number = MAX_BODY_SIZE
): NextResponse | null {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return NextResponse.json(
      { error: 'Payload too large' },
      { status: 413 }
    );
  }
  return null;
}
