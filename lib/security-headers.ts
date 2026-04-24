/**
 * Security Headers Middleware
 *
 * Single source of truth for security headers applied at the application level.
 * Nginx is configured to NOT set CSP (to avoid double/conflicting headers).
 * Nginx only sets HSTS, X-Content-Type-Options, and basic security headers.
 *
 * CSP exceptions documented:
 * - 'unsafe-inline' on style-src: required by Next.js inline styles, Radix UI,
 *   and TailwindCSS v4 runtime. Cannot be removed without breaking the UI.
 * - Jitsi frame-src: required for video conferencing embeds.
 * - wss: on connect-src: required for WebSocket connections (Jitsi, real-time).
 */

import { NextResponse } from 'next/server';

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
    // Content Security Policy — application-level (authoritative)
    const isDev = process.env.NODE_ENV === 'development';
    const csp = [
        "default-src 'self'",
        // Next.js requires 'unsafe-inline' for script; nonce-based CSP would need
        // custom Document + middleware per-request nonce — tracked as future improvement.
        // 'unsafe-eval' is required for WebAssembly (used by some client-side libraries).
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net`,
        // 'unsafe-inline' required for Radix UI, TailwindCSS v4 runtime styles
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
        "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://api.openai.com wss: data:",
        "frame-src https://meet.jit.si https://*.jitsi.net https://www.google.com https://maps.google.com",
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

    // Permissions-Policy
    response.headers.set(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=()'
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
