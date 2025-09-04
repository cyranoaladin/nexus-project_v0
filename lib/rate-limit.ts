// Simple in-memory rate limiter (per key). For multi-instance prod, use Redis.
type Counter = { count: number; resetAt: number; };
const bucketMap: Map<string, Counter> = new Map();

export function rateLimit(key: string, opts?: { windowMs?: number; max?: number; }): { ok: boolean; remaining: number; resetAt: number; } {
  const windowMs = Math.max(1000, Number(opts?.windowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS || 60000)));
  const max = Math.max(1, Number(opts?.max ?? Number(process.env.RATE_LIMIT_MAX || 60)));
  const now = Date.now();
  if (process.env.NODE_ENV === 'test') {
    return { ok: true, remaining: max, resetAt: now + windowMs };
  }
  const rec = bucketMap.get(key);
  if (rec && rec.resetAt > now) {
    if (rec.count >= max) return { ok: false, remaining: 0, resetAt: rec.resetAt };
    rec.count += 1; bucketMap.set(key, rec);
    return { ok: true, remaining: Math.max(0, max - rec.count), resetAt: rec.resetAt };
  }
  bucketMap.set(key, { count: 1, resetAt: now + windowMs });
  return { ok: true, remaining: max - 1, resetAt: now + windowMs };
}
