// Simple in-memory rate limiter (per IP + route) for Next.js API routes
// Not suitable for multi-instance production without shared store, but useful as a guard.

type Key = string;

const buckets = new Map<Key, { count: number; resetAt: number }>();

export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  return (key: Key) => {
    const now = Date.now();
    const entry = buckets.get(key);
    if (!entry || now > entry.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, remaining: max - 1, resetIn: windowMs };
    }
    if (entry.count >= max) {
      return { ok: false, remaining: 0, resetIn: entry.resetAt - now };
    }
    entry.count += 1;
    return { ok: true, remaining: max - entry.count, resetIn: entry.resetAt - now };
  };
}
