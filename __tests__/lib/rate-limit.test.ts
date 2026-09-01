import {
  guardRateLimitAsync,
  guardRateLimitValueAsync,
  guardRateLimitValueOnceAsync,
  resetRateLimitRuntimeForTests,
} from '@/lib/rate-limit/runtime'

describe('async rate-limit facade', () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_BACKEND = 'memory'
    process.env.RATE_LIMIT_KEY_SECRET = 'unit-rate-limit-key-secret-at-least-32-bytes'
    process.env.RATE_LIMIT_KEY_NAMESPACE = 'test'
    process.env.RATE_LIMIT_TRUST_PROXY_HOPS = '1'
    resetRateLimitRuntimeForTests()
  })

  function request(ip: string): Request {
    return new Request('https://nexus.test/api/test', {
      headers: { 'x-forwarded-for': ip },
    })
  }

  it('allows a request and applies identity normalization', async () => {
    await expect(guardRateLimitValueAsync({
      preset: 'authIdentity',
      keySuffix: 'login:identity',
      dimension: 'identity',
      value: ' Parent@Example.Test ',
    })).resolves.toBeNull()
    await expect(guardRateLimitValueAsync({
      preset: 'authIdentity',
      keySuffix: 'login:identity',
      dimension: 'identity',
      value: 'parent@example.test',
    })).resolves.toBeNull()
  })

  it('blocks after the configured limit and returns private retry metadata', async () => {
    const req = request('198.51.100.30')
    for (let index = 0; index < 5; index += 1) {
      await expect(guardRateLimitAsync(req, { preset: 'auth', keySuffix: 'login' })).resolves.toBeNull()
    }
    const response = await guardRateLimitAsync(req, { preset: 'auth', keySuffix: 'login' })
    expect(response?.status).toBe(429)
    expect(Number(response?.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(response?.headers.get('cache-control')).toContain('no-store')
    expect(response?.headers.get('pragma')).toBe('no-cache')
    expect(response?.headers.get('expires')).toBe('0')
  })

  it('isolates counters by client IP', async () => {
    for (let index = 0; index < 5; index += 1) {
      await guardRateLimitAsync(request('198.51.100.40'), { preset: 'auth', keySuffix: 'login' })
    }
    await expect(
      guardRateLimitAsync(request('198.51.100.41'), { preset: 'auth', keySuffix: 'login' }),
    ).resolves.toBeNull()
  })

  it('CODEX_IDEMPOTENT_ADMISSION returns one shared boundary decision for concurrent retries', async () => {
    const base = {
      preset: 'ai' as const,
      keySuffix: 'aria-conversation-execution',
      dimension: 'actor',
      value: 'student-actor-1',
    }
    for (let index = 0; index < 9; index += 1) {
      await expect(guardRateLimitValueOnceAsync({
        ...base,
        idempotencyValue: `prior-client-request-${index}`,
      })).resolves.toBeNull()
    }

    const retries = await Promise.all(Array.from({ length: 8 }, () =>
      guardRateLimitValueOnceAsync({ ...base, idempotencyValue: 'boundary-client-request' }),
    ))
    expect(retries).toEqual(Array.from({ length: 8 }, () => null))
    await expect(guardRateLimitValueOnceAsync({
      ...base,
      idempotencyValue: 'boundary-client-request',
    })).resolves.toBeNull()
    await expect(guardRateLimitValueOnceAsync({
      ...base,
      idempotencyValue: 'independent-over-limit-request',
    })).resolves.toMatchObject({ status: 429 })
  })
})
