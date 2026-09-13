/**
 * Security Headers Middleware
 *
 * Single source of truth for ALL security headers. Applied by Next.js
 * middleware (middleware.ts → applySecurityHeaders). Nginx reverse proxy
 * does NOT set any security headers — it only handles TLS termination,
 * proxying, and static file serving.
 *
 * CSP exceptions documented:
 * - 'unsafe-inline' on script-src: required by Next.js inline scripts.
 *   Nonce-based CSP would need custom Document + per-request nonce (tracked).
 * - 'unsafe-eval' on script-src: required for WebAssembly (some client libs).
 * - 'unsafe-inline' on style-src: required by Next.js inline styles, Radix UI,
 *   and TailwindCSS v4 runtime. Cannot be removed without breaking the UI.
 * - Jitsi frame-src: required for video conferencing embeds.
 * - wss: on connect-src: required for WebSocket connections (Jitsi, real-time).
 */

import { NextResponse } from 'next/server';

/**
 * Deliberately NOT imported from lib/jitsi.ts: this module is loaded by
 * middleware.ts, which runs on the Edge runtime by default (no explicit
 * `export const runtime = 'nodejs'`), and lib/jitsi.ts imports
 * `node:crypto` (for its HMAC room-seed helper) — pulling that in here
 * transitively would risk breaking on Edge. This is a narrow, read-only,
 * crypto-free duplicate of the same env read lib/jitsi.ts's
 * `getJitsiServerUrl()`/`getJitsiDomain()` perform, kept in sync by
 * reading the exact same `NEXT_PUBLIC_JITSI_SERVER_URL` variable.
 */
function getJitsiOriginForCsp(): string {
    const raw = process.env.NEXT_PUBLIC_JITSI_SERVER_URL || 'https://meet.jit.si';
    try {
        return new URL(raw).origin;
    } catch {
        return 'https://meet.jit.si';
    }
}

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
    const jitsiOrigin = getJitsiOriginForCsp();

    // Content Security Policy — application-level (authoritative)
    const csp = [
        "default-src 'self'",
        // Next.js requires 'unsafe-inline' for script; nonce-based CSP would need
        // custom Document + middleware per-request nonce — tracked as future improvement.
        // 'unsafe-eval' is required for WebAssembly (used by some client-side libraries).
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.googletagmanager.com`,
        // 'unsafe-inline' required for Radix UI, TailwindCSS v4 runtime styles
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
        "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://api.openai.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://www.google.com wss: data:",
        "worker-src 'self' blob: https://cdn.jsdelivr.net",
        `frame-src 'self' ${jitsiOrigin} https://*.jitsi.net https://www.google.com https://maps.google.com`,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
    ].join('; ');

    response.headers.set('Content-Security-Policy', csp);

    // Strict Transport Security
    response.headers.set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
    );

    // X-Frame-Options (legacy fallback for CSP frame-ancestors)
    response.headers.set('X-Frame-Options', 'DENY');

    // X-Content-Type-Options
    response.headers.set('X-Content-Type-Options', 'nosniff');

    // X-XSS-Protection (legacy header; kept for compatibility)
    response.headers.set('X-XSS-Protection', '1; mode=block');

    // Referrer-Policy
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy — must stay consistent with frame-src above: an
    // empty allowlist here blocks camera/microphone for EVERY context,
    // including an iframe CSP explicitly allows (a real, previously
    // unnoticed contradiction — the Jitsi iframe could never get camera/
    // mic access no matter what CSP said). Delegate camera/microphone to
    // the exact same Jitsi origin frame-src trusts, nothing else.
    response.headers.set(
        'Permissions-Policy',
        `camera=(self "${jitsiOrigin}"), microphone=(self "${jitsiOrigin}"), geolocation=()`
    );

    return response;
}

/**
 * Apply CORS headers for API routes
 */
export function applyCorsHeaders(
    response: NextResponse,
    allowedOrigins: string[] = []
): NextResponse {
    const origin = allowedOrigins.length > 0 ? allowedOrigins[0] : '*';

    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
    );
    response.headers.set('Access-Control-Max-Age', '86400');

    return response;
}
