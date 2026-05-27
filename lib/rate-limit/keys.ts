/**
 * Rate limit key generation helpers.
 *
 * For public routes: IP-based key (optionally combined with route).
 * For authenticated routes: userId-based key preferred.
 * Emails are never stored in plain text — use hashForKey() if needed.
 */

import { createHash } from 'crypto';
import { NextRequest } from 'next/server';

/**
 * Extract client IP from request headers.
 * Respects x-forwarded-for (first entry) and x-real-ip set by nginx.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'anonymous';
}

/**
 * Build a rate limit key from a request.
 *
 * @param request - The incoming request
 * @param prefix  - Namespace prefix (usually the preset name)
 * @param userId  - If available, use userId instead of IP for fairness
 */
export function buildKey(
  request: NextRequest,
  prefix: string,
  userId?: string | null,
): string {
  const identifier = userId || getClientIp(request);
  return `${prefix}:${identifier}`;
}

/**
 * One-way hash suitable for inclusion in a rate limit key.
 * Use this for emails or other PII that should not be stored in plain text.
 */
export function hashForKey(value: string): string {
  return createHash('sha256').update(value.toLowerCase().trim()).digest('hex').slice(0, 16);
}
