/**
 * Unified Rate Limiting — Complete Test Suite
 *
 * Tests the unified system in `lib/rate-limit/`:
 *  - MemoryStore (increment, cleanup, pruning, destroy)
 *  - Key generation (IP, userId, hashForKey)
 *  - Presets (all preset names exist with valid configs)
 *  - Public API (checkRateLimit, rateLimitResponse, guardRateLimit)
 *  - CI bypass (RATE_LIMIT_DISABLE=1)
 *  - Facade compatibility (lib/middleware/rateLimit.ts)
 */

import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  rateLimitResponse,
  guardRateLimit,
  _resetStoreForTests,
  PRESETS,
  buildKey,
  getClientIp,
  hashForKey,
  MemoryStore,
} from '@/lib/rate-limit';

// Helper: create a request with a given IP
function makeRequest(ip: string, url = 'http://localhost:3000/api/test'): NextRequest {
  return new NextRequest(url, {
    headers: { 'x-forwarded-for': ip },
  });
}

// ── MemoryStore ────────────────────────────────────────────────────────────

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore(100);
  });

  afterEach(() => {
    store.destroy();
  });

  it('should allow first request and return remaining = limit - 1', () => {
    const result = store.increment('test:1', 5, 60_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it('should decrement remaining on each increment', () => {
    store.increment('test:2', 3, 60_000);
    const r2 = store.increment('test:2', 3, 60_000);
    expect(r2.remaining).toBe(1);
    const r3 = store.increment('test:2', 3, 60_000);
    expect(r3.remaining).toBe(0);
    expect(r3.success).toBe(true);
  });

  it('should block when limit is exceeded', () => {
    store.increment('test:3', 2, 60_000);
    store.increment('test:3', 2, 60_000);
    const r3 = store.increment('test:3', 2, 60_000);
    expect(r3.success).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('should reset after window expires', () => {
    // Use a very short window
    store.increment('test:4', 1, 1); // 1ms window
    // Wait for expiry
    const start = Date.now();
    while (Date.now() - start < 5) { /* busy wait */ }
    const r2 = store.increment('test:4', 1, 1);
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(0);
  });

  it('should cleanup expired entries', () => {
    store.increment('expired', 1, 1); // 1ms window
    const start = Date.now();
    while (Date.now() - start < 5) { /* busy wait */ }
    store.cleanup();
    expect(store.size).toBe(0);
  });

  it('should prune when exceeding maxEntries', () => {
    const smallStore = new MemoryStore(3);
    smallStore.increment('a', 100, 60_000);
    smallStore.increment('b', 100, 60_000);
    smallStore.increment('c', 100, 60_000);
    smallStore.increment('d', 100, 60_000); // triggers prune
    expect(smallStore.size).toBeLessThanOrEqual(3);
    smallStore.destroy();
  });

  it('should clear on destroy', () => {
    store.increment('test:5', 5, 60_000);
    expect(store.size).toBe(1);
    store.destroy();
    expect(store.size).toBe(0);
  });
});

// ── Key generation ─────────────────────────────────────────────────────────

describe('Key generation', () => {
  it('getClientIp extracts x-forwarded-for (first entry)', () => {
    const req = new NextRequest('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('getClientIp falls back to x-real-ip', () => {
    const req = new NextRequest('http://localhost', {
      headers: { 'x-real-ip': '9.8.7.6' },
    });
    expect(getClientIp(req)).toBe('9.8.7.6');
  });

  it('getClientIp returns anonymous when no header', () => {
    const req = new NextRequest('http://localhost');
    expect(getClientIp(req)).toBe('anonymous');
  });

  it('buildKey uses IP by default', () => {
    const req = makeRequest('1.2.3.4');
    expect(buildKey(req, 'api')).toBe('api:1.2.3.4');
  });

  it('buildKey uses userId when provided', () => {
    const req = makeRequest('1.2.3.4');
    expect(buildKey(req, 'api', 'user-123')).toBe('api:user-123');
  });

  it('hashForKey produces consistent 16-char hex', () => {
    const h1 = hashForKey('test@example.com');
    const h2 = hashForKey('TEST@EXAMPLE.COM');
    expect(h1).toBe(h2); // case-insensitive
    expect(h1).toHaveLength(16);
    expect(h1).toMatch(/^[0-9a-f]{16}$/);
  });

  it('hashForKey trims whitespace', () => {
    expect(hashForKey('  test@example.com  ')).toBe(hashForKey('test@example.com'));
  });
});

// ── Presets ─────────────────────────────────────────────────────────────────

describe('Presets', () => {
  const expectedPresets = ['auth', 'resendActivation', 'api', 'expensive', 'ai', 'notifyEmail', 'public'];

  it.each(expectedPresets)('preset "%s" exists with valid config', (name) => {
    const preset = PRESETS[name as keyof typeof PRESETS];
    expect(preset).toBeDefined();
    expect(preset.limit).toBeGreaterThan(0);
    expect(preset.windowMs).toBeGreaterThan(0);
  });

  it('auth has strict limits (5 req / 15 min)', () => {
    expect(PRESETS.auth.limit).toBe(5);
    expect(PRESETS.auth.windowMs).toBe(15 * 60 * 1000);
  });

  it('api has moderate limits (60 req / 1 min)', () => {
    expect(PRESETS.api.limit).toBe(60);
    expect(PRESETS.api.windowMs).toBe(60 * 1000);
  });
});

// ── Public API ──────────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  beforeEach(() => {
    _resetStoreForTests();
  });

  it('returns success=true for first request', () => {
    const req = makeRequest('10.0.0.1');
    const result = checkRateLimit(req, { preset: 'api' });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(59); // api limit=60
    expect(result.retryAfter).toBe(0);
  });

  it('returns success=false when limit exceeded', () => {
    const req = makeRequest('10.0.0.2');
    // Exhaust auth limit (5)
    for (let i = 0; i < 5; i++) {
      checkRateLimit(req, { preset: 'auth' });
    }
    const result = checkRateLimit(req, { preset: 'auth' });
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('uses keySuffix for sub-scoping', () => {
    const req = makeRequest('10.0.0.3');
    // Exhaust with suffix A
    for (let i = 0; i < 5; i++) {
      checkRateLimit(req, { preset: 'auth', keySuffix: 'routeA' });
    }
    // Suffix B should still have capacity
    const result = checkRateLimit(req, { preset: 'auth', keySuffix: 'routeB' });
    expect(result.success).toBe(true);
  });

  it('uses userId when provided', () => {
    const req = makeRequest('10.0.0.4');
    // Exhaust for userId=alice
    for (let i = 0; i < 5; i++) {
      checkRateLimit(req, { preset: 'auth', userId: 'alice' });
    }
    // Same IP, different userId should still have capacity
    const result = checkRateLimit(req, { preset: 'auth', userId: 'bob' });
    expect(result.success).toBe(true);
  });
});

describe('rateLimitResponse', () => {
  it('returns 429 with correct headers and body', async () => {
    const result = {
      success: false,
      limit: 5,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfter: 60,
    };
    const resp = rateLimitResponse(result);
    expect(resp.status).toBe(429);
    expect(resp.headers.get('Retry-After')).toBe('60');
    expect(resp.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(resp.headers.get('X-RateLimit-Remaining')).toBe('0');
    const body = await resp.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});

describe('guardRateLimit', () => {
  beforeEach(() => {
    _resetStoreForTests();
  });

  it('returns null when under limit', () => {
    const req = makeRequest('10.0.1.1');
    const result = guardRateLimit(req, { preset: 'api' });
    expect(result).toBeNull();
  });

  it('returns NextResponse(429) when limit exceeded', () => {
    const req = makeRequest('10.0.1.2');
    for (let i = 0; i < 5; i++) {
      guardRateLimit(req, { preset: 'auth' });
    }
    const result = guardRateLimit(req, { preset: 'auth' });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });
});

// ── CI bypass ───────────────────────────────────────────────────────────────

describe('CI bypass (RATE_LIMIT_DISABLE)', () => {
  const originalEnv = process.env.RATE_LIMIT_DISABLE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.RATE_LIMIT_DISABLE;
    } else {
      process.env.RATE_LIMIT_DISABLE = originalEnv;
    }
    _resetStoreForTests();
  });

  it('checkRateLimit always succeeds when RATE_LIMIT_DISABLE=1', () => {
    process.env.RATE_LIMIT_DISABLE = '1';
    const req = makeRequest('10.0.2.1');
    // Even beyond any limit, should succeed
    for (let i = 0; i < 1000; i++) {
      const result = checkRateLimit(req, { preset: 'auth' });
      expect(result.success).toBe(true);
    }
  });

  it('guardRateLimit returns null when RATE_LIMIT_DISABLE=1', () => {
    process.env.RATE_LIMIT_DISABLE = '1';
    const req = makeRequest('10.0.2.2');
    const result = guardRateLimit(req, { preset: 'auth' });
    expect(result).toBeNull();
  });
});

// ── Facade compatibility ────────────────────────────────────────────────────

describe('Facade (lib/middleware/rateLimit)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RateLimitPresets } = require('@/lib/middleware/rateLimit');

  beforeEach(() => {
    _resetStoreForTests();
  });

  it('RateLimitPresets.api returns null when under limit', () => {
    const req = makeRequest('10.0.3.1');
    const result = RateLimitPresets.api(req, 'test-route');
    expect(result).toBeNull();
  });

  it('RateLimitPresets.auth blocks after 5 requests', () => {
    const req = makeRequest('10.0.3.2');
    for (let i = 0; i < 5; i++) {
      RateLimitPresets.auth(req, 'test-auth');
    }
    const result = RateLimitPresets.auth(req, 'test-auth');
    expect(result).not.toBeNull();
    expect(result.status).toBe(429);
  });

  it('RateLimitPresets.expensive blocks after limit', () => {
    const req = makeRequest('10.0.3.3');
    for (let i = 0; i < 10; i++) {
      RateLimitPresets.expensive(req, 'test-expensive');
    }
    const result = RateLimitPresets.expensive(req, 'test-expensive');
    expect(result).not.toBeNull();
    expect(result.status).toBe(429);
  });
});
