// Rate limiter with Redis (prod) or in-memory (dev)
// API-compatible with previous implementation.
import type { Redis } from 'ioredis';

type Key = string;

let redis: Redis | null = null;
(async () => {
  try {
    if (process.env.REDIS_URL) {
      const IORedis = (await import('ioredis')).default;
      redis = new IORedis(process.env.REDIS_URL as string, {
        maxRetriesPerRequest: 2,
        lazyConnect: true,
      });
      // don't actually connect until first usage
    }
  } catch {
    redis = null;
  }
})();

const memoryBuckets = new Map<Key, { count: number; resetAt: number }>();

export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  if (redis) {
    return async (key: Key) => {
      const now = Date.now();
      const windowKey = `rl:${key}:${Math.floor(now / windowMs)}`;
      try {
        if ((redis as any).status !== 'ready') {
          await redis!.connect().catch(() => {});
        }
        const count = await redis!.incr(windowKey);
        if (count === 1) {
          await redis!.pexpire(windowKey, windowMs);
        }
        const ttl = await redis!.pttl(windowKey);
        const remaining = Math.max(0, max - count);
        return { ok: count <= max, remaining, resetIn: ttl > 0 ? ttl : windowMs };
      } catch {
        // Fallback to memory if Redis failed
        return memoryLimiter(windowMs, max, key);
      }
    };
  }
  return (key: Key) => memoryLimiter(windowMs, max, key);
}

function memoryLimiter(windowMs: number, max: number, key: Key) {
  const now = Date.now();
  const entry = memoryBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, resetIn: windowMs };
  }
  if (entry.count >= max) {
    return { ok: false, remaining: 0, resetIn: entry.resetAt - now };
  }
  entry.count += 1;
  return { ok: true, remaining: max - entry.count, resetIn: entry.resetAt - now };
}
