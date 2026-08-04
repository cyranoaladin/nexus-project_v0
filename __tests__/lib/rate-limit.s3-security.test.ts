import {
  assertRateLimitRuntimeConfiguration,
  resolveTrustedClientIp,
} from '@/lib/rate-limit/runtime'
import { deriveRateLimitKey } from '@/lib/rate-limit/keys'

describe('S3 distributed rate-limit security contract', () => {
  const original = { ...process.env }

  beforeEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: 'production' })
    process.env.RATE_LIMIT_BACKEND = 'redis'
    process.env.REDIS_URL = 'redis://127.0.0.1:6379'
    process.env.RATE_LIMIT_KEY_SECRET = 'security-rate-limit-key-secret-at-least-32-bytes'
    process.env.RATE_LIMIT_KEY_NAMESPACE = 'production'
    process.env.RATE_LIMIT_TRUST_PROXY_HOPS = '1'
  })

  afterAll(() => {
    process.env = original
  })

  it('refuses missing or memory production backends and accepts complete Redis configuration', () => {
    delete process.env.RATE_LIMIT_BACKEND
    expect(() => assertRateLimitRuntimeConfiguration()).toThrow('RATE_LIMIT_CONFIGURATION_INVALID')
    process.env.RATE_LIMIT_BACKEND = 'memory'
    expect(() => assertRateLimitRuntimeConfiguration()).toThrow('RATE_LIMIT_PRODUCTION_MEMORY_REFUSED')
    process.env.RATE_LIMIT_BACKEND = 'redis'
    expect(() => assertRateLimitRuntimeConfiguration()).not.toThrow()
  })

  it('derives opaque HMAC keys separated by environment, scope and dimension', () => {
    const email = 'parent@example.test'
    const signup = deriveRateLimitKey('parent-signup', 'identity', email)
    const resend = deriveRateLimitKey('activation-resend', 'identity', email)
    const ip = deriveRateLimitKey('parent-signup', 'ip', email)

    expect(signup).toMatch(/^rl:v1:production:parent-signup:identity:[a-f0-9]{64}$/)
    expect(signup).not.toContain(email)
    expect(new Set([signup, resend, ip]).size).toBe(3)
  })

  it('uses the right-most address supplied by one trusted Nginx proxy', () => {
    const request = new Request('https://nexus.test', {
      headers: { 'x-forwarded-for': '198.51.100.9, 203.0.113.42' },
    })
    expect(resolveTrustedClientIp(request)).toBe('203.0.113.42')
  })

  it('ignores a forged leading address and accepts normalized IPv4-mapped IPv6', () => {
    const request = new Request('https://nexus.test', {
      headers: { 'x-forwarded-for': '192.0.2.1, ::ffff:203.0.113.10' },
    })
    expect(resolveTrustedClientIp(request)).toBe('203.0.113.10')
  })

  it('normalizes canonically equivalent Unicode identities before HMAC derivation', () => {
    expect(deriveRateLimitKey('login', 'identity', 'PARE\u0301NT@example.test')).toBe(
      deriveRateLimitKey('login', 'identity', 'parént@example.test'),
    )
  })
})
