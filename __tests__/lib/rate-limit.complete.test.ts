import { RateLimitPresets, resolveTrustedClientIp } from '@/lib/rate-limit/runtime'
import { deriveRateLimitKey } from '@/lib/rate-limit/keys'
import { MemoryStore } from '@/lib/rate-limit/memory-store'

describe('rate-limit complete async contract', () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_KEY_SECRET = 'complete-rate-limit-key-secret-at-least-32-bytes'
    process.env.RATE_LIMIT_KEY_NAMESPACE = 'test'
    process.env.RATE_LIMIT_TRUST_PROXY_HOPS = '1'
  })

  it('defines bounded positive limits and windows for every preset', () => {
    for (const preset of Object.values(RateLimitPresets)) {
      expect(preset.limit).toBeGreaterThan(0)
      expect(preset.windowMs).toBeGreaterThan(0)
      expect(preset.windowMs).toBeLessThanOrEqual(60 * 60_000)
    }
  })

  it('keeps deterministic counters in the explicit test memory store', () => {
    const store = new MemoryStore()
    expect(store.increment('key', 2, 1_000)).toEqual(expect.objectContaining({ success: true, remaining: 1 }))
    expect(store.increment('key', 2, 1_000)).toEqual(expect.objectContaining({ success: true, remaining: 0 }))
    expect(store.increment('key', 2, 1_000)).toEqual(expect.objectContaining({ success: false, remaining: 0 }))
    store.destroy()
  })

  it('normalizes trusted IPv4-mapped addresses and rejects malformed input', () => {
    expect(resolveTrustedClientIp(new Request('https://nexus.test', {
      headers: { 'x-forwarded-for': '::ffff:203.0.113.8' },
    }))).toBe('203.0.113.8')
    expect(resolveTrustedClientIp(new Request('https://nexus.test', {
      headers: { 'x-forwarded-for': 'not-an-ip' },
    }))).toBe('test-client')
  })

  it('never embeds raw identity material in a storage key', () => {
    const key = deriveRateLimitKey('password-reset', 'identity', 'Parent@Example.Test')
    expect(key).toMatch(/^rl:v1:test:password-reset:identity:[a-f0-9]{64}$/)
    expect(key).not.toContain('parent')
    expect(key).not.toContain('example')
  })
})
