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

import { NextResponse } from 'next/server';
import { MemoryStore } from './memory-store';
import { RedisStore } from './redis-store';
import { UpstashStore } from './upstash-store';
import { PRESETS, type PresetName, type RateLimitPresetConfig } from './presets';
import { buildKey } from './keys';

// ── Singleton store ────────────────────────────────────────────────
let _store: MemoryStore | null = null;
let _redisStore: RedisStore | null = null;
let _upstashStore: UpstashStore | null = null;
let _distributedWarned = false;

function getStore(): MemoryStore {
  if (!_store) {
    _store = new MemoryStore();
    MemoryStore.warnFallbackOnce();
    // P1-02 hardening: production MUST use distributed rate limiting
    if (process.env.NODE_ENV === 'production' && getRateLimitRuntimeMode() === 'memory') {
      console.error('[CRITICAL] Rate limiting runs in memory mode in production. Configure REDIS_URL or UPSTASH_REDIS_REST_URL.');
    }
  }
  return _store;
}

/** For tests only: replace the singleton with a fresh store. */
export function _resetStoreForTests(): MemoryStore {
  _store?.destroy();
  _store = new MemoryStore();
  void _redisStore?.destroy();
  _redisStore = null;
  _upstashStore = null;
  _distributedWarned = false;
  return _store;
}

export type RateLimitRuntimeMode = 'memory' | 'redis' | 'upstash';

function canBypassRateLimit(): boolean {
  return process.env.RATE_LIMIT_DISABLE === '1' && process.env.NODE_ENV !== 'production';
}

export function getRateLimitRuntimeMode(): RateLimitRuntimeMode {
  if (process.env.REDIS_URL) {
    return 'redis';
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return 'upstash';
  }
  return 'memory';
}

function getDistributedStore(): RedisStore | UpstashStore | null {
  const mode = getRateLimitRuntimeMode();

  if (mode === 'redis') {
    if (!_redisStore) {
      _redisStore = new RedisStore(process.env.REDIS_URL!);
    }
    return _redisStore;
  }

  if (mode !== 'upstash') return null;

  if (!_upstashStore) {
    _upstashStore = new UpstashStore({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  return _upstashStore;
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
  request: Request,
  options: CheckRateLimitOptions,
): RateLimitResult {
  // CI/E2E bypass
  if (canBypassRateLimit()) {
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
 * Async variant used by public write routes. It uses Upstash REST when
 * configured and falls back to MemoryStore otherwise.
 */
export async function checkRateLimitAsync(
  request: Request,
  options: CheckRateLimitOptions,
): Promise<RateLimitResult> {
  if (canBypassRateLimit()) {
    return { success: true, limit: Infinity, remaining: Infinity, resetAt: 0, retryAfter: 0 };
  }

  const config: RateLimitPresetConfig = PRESETS[options.preset];
  const prefix = options.keySuffix
    ? `${options.preset}:${options.keySuffix}`
    : options.preset;
  const key = buildKey(request, prefix, options.userId);

  const distributedStore = getDistributedStore();
  if (distributedStore) {
    try {
      const { success, limit, remaining, resetAt } = await distributedStore.increment(
        key,
        config.limit,
        config.windowMs,
      );
      const retryAfter = success ? 0 : Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
      return { success, limit, remaining, resetAt, retryAfter };
    } catch (error) {
      if (!_distributedWarned && process.env.NODE_ENV !== 'test') {
        _distributedWarned = true;
        console.warn('[rate-limit] Distributed store unavailable, falling back to memory store:', error instanceof Error ? error.name : 'unknown');
      }
    }
  }

  return checkRateLimit(request, options);
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
  request: Request,
  options: CheckRateLimitOptions,
): NextResponse | null {
  const result = checkRateLimit(request, options);
  if (!result.success) return rateLimitResponse(result);
  return null;
}

export async function guardRateLimitAsync(
  request: Request,
  options: CheckRateLimitOptions,
): Promise<NextResponse | null> {
  const result = await checkRateLimitAsync(request, options);
  if (!result.success) return rateLimitResponse(result);
  return null;
}

// Re-exports for convenience
export { PRESETS, type PresetName } from './presets';
export { buildKey, getClientIp, hashForKey } from './keys';
export { MemoryStore } from './memory-store';
export { RedisStore } from './redis-store';
export { UpstashStore } from './upstash-store';
