/**
 * Rate limit key generation helpers.
 *
 * For public routes: IP-based key (optionally combined with route).
 * For authenticated routes: userId-based key preferred.
 * Emails are never stored in plain text — use hashForKey() if needed.
 */

import { createHash } from 'crypto';
import { isIP } from 'node:net';

const MAX_FORWARDED_HEADER_LENGTH = 2048;
const MAX_FORWARDED_ENTRIES = 32;
const MAX_IP_LENGTH = 64;

function validatedIp(value: string | null): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.length > MAX_IP_LENGTH || isIP(candidate) === 0) {
    return null;
  }
  return candidate;
}

/**
 * Extract client IP from request headers.
 *
 * nginx appends its observed peer to x-forwarded-for. The right-most valid
 * entry is therefore the value the application can use without trusting a
 * client-supplied prefix. Invalid or unreasonably large headers are ignored.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded && forwarded.length <= MAX_FORWARDED_HEADER_LENGTH) {
    const entries = forwarded.split(',').slice(-MAX_FORWARDED_ENTRIES);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const ip = validatedIp(entries[index]);
      if (ip) return ip;
    }
  }

  return validatedIp(request.headers.get('x-real-ip')) || 'anonymous';
}

/**
 * Build a rate limit key from a request.
 *
 * @param request - The incoming request
 * @param prefix  - Namespace prefix (usually the preset name)
 * @param userId  - If available, use userId instead of IP for fairness
 */
export function buildKey(
  request: Request,
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
