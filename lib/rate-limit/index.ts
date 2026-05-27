/**
 * Unified Rate Limiting — single entry point.
 *
 * Usage in API routes:
 *
 *   import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
 *
 *   const rl = checkRateLimit(request, { preset: 'api' });
 *   if (!rl.success) return rateLimitResponse(rl);
 *
 * For authenticated routes, pass userId for fairer per-user limits:
 *
 *   const rl = checkRateLimit(request, { preset: 'expensive', userId: session.user.id });
 *   if (!rl.success) return rateLimitResponse(rl);
 */

import { NextRequest, NextResponse } from 'next/server';
import { MemoryStore } from './memory-store';
import { PRESETS, type PresetName, type RateLimitPresetConfig } from './presets';
import { buildKey } from './keys';

// ── Singleton store ────────────────────────────────────────────────
let _store: MemoryStore | null = null;

function getStore(): MemoryStore {
  if (!_store) {
    _store = new MemoryStore();
    MemoryStore.warnFallbackOnce();
  }
  return _store;
}

/** For tests only: replace the singleton with a fresh store. */
export function _resetStoreForTests(): MemoryStore {
  _store?.destroy();
  _store = new MemoryStore();
  return _store;
}

// ── Public API ─────────────────────────────────────────────────────

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Absolute timestamp (ms) when the window resets. */
  resetAt: number;
  /** Seconds until the window resets — included in 429 Retry-After. */
  retryAfter: number;
}

export interface CheckRateLimitOptions {
  /** Named preset from PRESETS. */
  preset: PresetName;
  /** Override: use userId instead of IP for the key. */
  userId?: string | null;
  /** Optional extra key suffix for sub-scoping (e.g. route path). */
  keySuffix?: string;
}

/**
 * Check (and increment) the rate limit for a request.
 * Always returns a result — never throws.
 */
export function checkRateLimit(
  request: NextRequest,
  options: CheckRateLimitOptions,
): RateLimitResult {
  // CI/E2E bypass
  if (process.env.RATE_LIMIT_DISABLE === '1') {
    return { success: true, limit: Infinity, remaining: Infinity, resetAt: 0, retryAfter: 0 };
  }

  const config: RateLimitPresetConfig = PRESETS[options.preset];
  const prefix = options.keySuffix
    ? `${options.preset}:${options.keySuffix}`
    : options.preset;

  const key = buildKey(request, prefix, options.userId);
  const store = getStore();
  const { success, limit, remaining, resetAt } = store.increment(key, config.limit, config.windowMs);
  const retryAfter = success ? 0 : Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));

  return { success, limit, remaining, resetAt, retryAfter };
}

/**
 * Build a 429 NextResponse from a failed rate limit result.
 * Includes standard rate limit headers + Retry-After.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const body = {
    ok: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de requêtes. Veuillez réessayer plus tard.',
    },
  };

  const response = NextResponse.json(body, { status: 429 });

  response.headers.set('Retry-After', result.retryAfter.toString());
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

  return response;
}

/**
 * Convenience: check + auto-return 429 if exceeded.
 * Returns null when under limit, or a NextResponse(429) when exceeded.
 *
 * Usage:
 *   const blocked = guardRateLimit(request, { preset: 'auth' });
 *   if (blocked) return blocked;
 */
export function guardRateLimit(
  request: NextRequest,
  options: CheckRateLimitOptions,
): NextResponse | null {
  const result = checkRateLimit(request, options);
  if (!result.success) return rateLimitResponse(result);
  return null;
}

// Re-exports for convenience
export { PRESETS, type PresetName } from './presets';
export { buildKey, getClientIp, hashForKey } from './keys';
export { MemoryStore } from './memory-store';
