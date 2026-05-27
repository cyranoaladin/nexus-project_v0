/**
 * Rate Limiting Middleware — Compatibility Facade
 *
 * Delegates to the unified rate-limit system in `@/lib/rate-limit`.
 * Existing routes can keep their `RateLimitPresets.api(request, 'prefix')` calls
 * without modification; under the hood, a single MemoryStore is used.
 *
 * New routes should import directly from `@/lib/rate-limit` instead.
 *
 * @deprecated Import from `@/lib/rate-limit` for new code.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  guardRateLimit,
  type PresetName,
} from '@/lib/rate-limit';

// ── Preset mapping ────────────────────────────────────────────────────
// Maps old System B preset names to unified preset names.
// NOTE: "expensive" changed from 10 req/min → 10 req/hour (intentional
// tightening for sensitive operations like session booking/cancellation).
// "api" changed from 100 req/min → 60 req/min.

const PRESET_MAP: Record<string, PresetName> = {
  auth: 'auth',
  api: 'api',
  expensive: 'expensive',
  public: 'public',
};

/**
 * Build a facade function that matches the old `rateLimit(config)(request, prefix)` signature.
 * Returns `NextResponse | null` — null means "allowed".
 */
function buildPreset(presetKey: string): (request: NextRequest, keyPrefix?: string) => NextResponse | null {
  const preset = PRESET_MAP[presetKey] ?? 'api';

  return (request: NextRequest, keyPrefix?: string): NextResponse | null => {
    return guardRateLimit(request, {
      preset,
      keySuffix: keyPrefix,
    });
  };
}

/**
 * Preset rate limiters for common scenarios.
 *
 * @deprecated Use `guardRateLimit(request, { preset: '...' })` from `@/lib/rate-limit`.
 */
export const RateLimitPresets = {
  auth: buildPreset('auth'),
  api: buildPreset('api'),
  expensive: buildPreset('expensive'),
  public: buildPreset('public'),
};

/**
 * Rate limit middleware factory — compatibility wrapper.
 *
 * @deprecated Use `guardRateLimit` from `@/lib/rate-limit`.
 */
export function rateLimit(config: { windowMs: number; maxRequests: number; message?: string }) {
  // Find the closest matching preset, or fall back to 'api'
  let matchedPreset: PresetName = 'api';
  if (config.maxRequests <= 5 && config.windowMs >= 10 * 60 * 1000) matchedPreset = 'auth';
  else if (config.maxRequests <= 10 && config.windowMs >= 30 * 60 * 1000) matchedPreset = 'expensive';
  else if (config.maxRequests >= 200) matchedPreset = 'public';

  return (request: NextRequest, keyPrefix?: string): NextResponse | null => {
    return guardRateLimit(request, {
      preset: matchedPreset,
      keySuffix: keyPrefix,
    });
  };
}

/**
 * @deprecated No-op in the unified system. Use `_resetStoreForTests()` from `@/lib/rate-limit`.
 */
export function clearRateLimit(_request: NextRequest, _prefix: string = 'rl'): void {
  // No-op — the unified store doesn't support per-key clearing.
  // Tests should use _resetStoreForTests() to reset the full store.
}

/**
 * @deprecated Use `checkRateLimit()` from `@/lib/rate-limit` instead.
 */
export function getRateLimitStatus(
  _request: NextRequest,
  config: { windowMs: number; maxRequests: number },
  _prefix: string = 'rl',
): { remaining: number; resetTime: number } {
  // Approximate: return max capacity (no state inspection in unified store)
  return {
    remaining: config.maxRequests,
    resetTime: Date.now() + config.windowMs,
  };
}
