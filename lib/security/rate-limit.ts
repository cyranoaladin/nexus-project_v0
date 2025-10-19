// Simple in-memory rate limiter (token bucket per key)
// NOTE: For production, prefer Redis store. This fallback protects basic abuse.

const buckets = new Map<string, { tokens: number; updatedAt: number }>();

export type RateLimitOptions = {
  windowMs: number; // e.g., 60_000
  max: number;      // e.g., 5
};

function nowMs() {
  return Date.now();
}

export function rateLimit(key: string, opts: RateLimitOptions): { allowed: boolean; remaining: number } {
  const ts = nowMs();
  const b = buckets.get(key);
  if (!b) {
    const state = { tokens: opts.max - 1, updatedAt: ts };
    buckets.set(key, state);
    return { allowed: true, remaining: state.tokens };
  }

  const elapsed = ts - b.updatedAt;
  if (elapsed > opts.windowMs) {
    b.tokens = opts.max - 1;
    b.updatedAt = ts;
    return { allowed: true, remaining: b.tokens };
  }

  if (b.tokens <= 0) {
    return { allowed: false, remaining: 0 };
  }

  b.tokens -= 1;
  return { allowed: true, remaining: b.tokens };
}

export function ipKey(ip: string | null | undefined, scope: string) {
  return `${scope}:${ip || 'unknown'}`;
}
