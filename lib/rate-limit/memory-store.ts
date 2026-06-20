/**
 * Bounded in-memory rate limit store with TTL-based cleanup.
 *
 * Limitations (documented, not bugs):
 * - In PM2 cluster mode each worker has its own store, so effective limits
 *   are multiplied by the number of workers.  This is acceptable for P0.5;
 *   a shared Redis store can be added later.
 * - Data is lost on process restart — this is by design for a rate limiter.
 */

interface Entry {
  count: number;
  /** Absolute timestamp (ms) when this window expires */
  resetAt: number;
}

const DEFAULT_MAX_ENTRIES = 10_000;
const CLEANUP_INTERVAL_MS = 60_000; // 1 min

export class MemoryStore {
  private store = new Map<string, Entry>();
  private readonly maxEntries: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private static fallbackWarned = false;

  constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
    this.startCleanup();
  }

  /** Log once that memory fallback is active (not per-request). */
  static warnFallbackOnce(): void {
    if (!MemoryStore.fallbackWarned) {
      MemoryStore.fallbackWarned = true;
      if (process.env.NODE_ENV !== 'test') {
        // memory-only mode (no Redis/Upstash configured)
      }
    }
  }

  /**
   * Increment the counter for `key` within a sliding window of `windowMs`.
   * Returns the current state *after* incrementing.
   */
  increment(key: string, limit: number, windowMs: number): {
    success: boolean;
    limit: number;
    remaining: number;
    resetAt: number;
  } {
    const now = Date.now();
    const entry = this.store.get(key);

    // Expired or new key — start fresh window
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + windowMs;
      this.store.set(key, { count: 1, resetAt });
      this.pruneIfNeeded();
      return { success: true, limit, remaining: limit - 1, resetAt };
    }

    // Within window — check limit before incrementing
    if (entry.count >= limit) {
      return { success: false, limit, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return {
      success: true,
      limit,
      remaining: limit - entry.count,
      resetAt: entry.resetAt,
    };
  }

  /** Remove all expired entries. */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /** If store exceeds max size, drop oldest entries. */
  private pruneIfNeeded(): void {
    if (this.store.size <= this.maxEntries) return;

    // Delete the first (oldest-inserted) entries until under limit
    const excess = this.store.size - this.maxEntries;
    let deleted = 0;
    for (const key of this.store.keys()) {
      if (deleted >= excess) break;
      this.store.delete(key);
      deleted++;
    }
  }

  private startCleanup(): void {
    // Skip in test environment to avoid open handles
    if (process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined') {
      return;
    }
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    // Allow process to exit even if timer is running
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  /** For testing: stop the cleanup timer and clear the store. */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
