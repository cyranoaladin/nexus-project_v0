import { createClient } from 'redis'

import {
  guardRateLimitAsync,
  resetRateLimitRuntimeForTests,
} from '@/lib/rate-limit/runtime'
import { deriveRateLimitKey } from '@/lib/rate-limit/keys'

jest.mock('redis', () => ({ createClient: jest.fn() }))

describe('production rate-limit failure policy', () => {
  const original = { ...process.env }
  const mockEval = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    resetRateLimitRuntimeForTests()
    Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: 'production' })
    process.env.RATE_LIMIT_BACKEND = 'redis'
    process.env.REDIS_URL = 'redis://127.0.0.1:6379'
    process.env.RATE_LIMIT_KEY_SECRET = 'production-rate-limit-secret-at-least-32-bytes'
    process.env.RATE_LIMIT_KEY_NAMESPACE = 'production'
    process.env.RATE_LIMIT_TRUST_PROXY_HOPS = '1'
    ;(createClient as jest.Mock).mockReturnValue({
      isOpen: true,
      connect: jest.fn(),
      eval: mockEval,
      disconnect: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
    })
  })

  afterAll(() => {
    process.env = original
  })

  it('fails closed instead of silently using memory when Redis fails in production', async () => {
    mockEval.mockRejectedValueOnce(new Error('redis unavailable'))
    const response = await guardRateLimitAsync(
      new Request('https://nexus.test/api/test', {
        headers: { 'x-forwarded-for': '198.51.100.20' },
      }),
      { preset: 'auth', keySuffix: 'test' },
    )

    expect(response?.status).toBe(503)
    expect(response?.headers.get('cache-control')).toContain('no-store')
    expect(await response?.json()).toEqual({
      error: {
        code: 'RATE_LIMIT_BACKEND_UNAVAILABLE',
        message: 'Service temporarily unavailable',
      },
    })
  })

  it('normalizes and HMACs equivalent identities without exposing PII', () => {
    const decomposed = deriveRateLimitKey('login', 'identity', ' PARE\u0301NT@EXAMPLE.TEST ')
    const normalized = deriveRateLimitKey('login', 'identity', 'parént@example.test')
    expect(decomposed).toBe(normalized)
    expect(decomposed).not.toContain('parent')
    expect(decomposed).not.toContain('example')
  })
})
