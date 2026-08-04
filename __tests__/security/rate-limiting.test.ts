import {
  guardSensitiveRateLimit,
  SENSITIVE_RATE_LIMIT_POLICIES,
} from '@/lib/rate-limit/sensitive'
import { resetRateLimitRuntimeForTests } from '@/lib/rate-limit/runtime'

describe('rate limiting security', () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_BACKEND = 'memory'
    process.env.RATE_LIMIT_KEY_SECRET = 'security-test-key-secret-at-least-32-bytes'
    process.env.RATE_LIMIT_KEY_NAMESPACE = 'test'
    process.env.RATE_LIMIT_TRUST_PROXY_HOPS = '1'
    resetRateLimitRuntimeForTests()
  })

  it('centralizes all sensitive scopes with at least one bounded dimension', () => {
    expect(Object.keys(SENSITIVE_RATE_LIMIT_POLICIES).length).toBeGreaterThanOrEqual(29)
    for (const policy of Object.values(SENSITIVE_RATE_LIMIT_POLICIES)) {
      expect('ipPreset' in policy || 'identityPreset' in policy || 'resourcePreset' in policy).toBe(true)
    }
  })

  it('blocks an identity without exposing it in the response', async () => {
    const request = new Request('https://nexus.test/api/auth/resend-activation', {
      headers: { 'x-forwarded-for': '198.51.100.80' },
    })
    for (let index = 0; index < 3; index += 1) {
      await expect(guardSensitiveRateLimit(request, {
        scope: 'activation-resend',
        identity: 'private-parent@example.test',
      })).resolves.toBeNull()
    }
    const response = await guardSensitiveRateLimit(request, {
      scope: 'activation-resend',
      identity: 'private-parent@example.test',
    })
    const body = await response?.text()
    expect(response?.status).toBe(429)
    expect(response?.headers.get('cache-control')).toContain('no-store')
    expect(body).not.toContain('private-parent')
    expect(body).not.toContain('example.test')
  })
})
