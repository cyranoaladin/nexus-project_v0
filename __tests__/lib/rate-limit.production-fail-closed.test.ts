import { NextRequest } from 'next/server'

import { _resetStoreForTests, checkRateLimitAsync, hashForKey } from '@/lib/rate-limit'

const mockIncrement = jest.fn()
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    isOpen: false,
    connect: jest.fn().mockResolvedValue(undefined),
    incr: mockIncrement,
    expire: jest.fn(),
    ttl: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  })),
}))

describe('production rate-limit failure policy', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalRedisUrl = process.env.REDIS_URL

  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv })
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL
    else process.env.REDIS_URL = originalRedisUrl
    _resetStoreForTests()
  })

  it('fails closed instead of silently using memory when Redis fails in production', async () => {
    Object.assign(process.env, { NODE_ENV: 'production', REDIS_URL: 'redis://127.0.0.1:6379' })
    mockIncrement.mockRejectedValueOnce(new Error('redis unavailable'))
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const result = await checkRateLimitAsync(new NextRequest('http://localhost/api/test'), {
      preset: 'auth',
    })
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
    expect(consoleError).toHaveBeenCalledWith('[rate-limit] Distributed backend unavailable')
    consoleError.mockRestore()
  })

  it('normalizes and hashes equivalent addresses without exposing PII', () => {
    const composed = hashForKey(' PARÉNT@EXAMPLE.TEST ')
    const normalized = hashForKey('parént@example.test')
    expect(composed).toBe(normalized)
    expect(composed).not.toContain('parent')
    expect(composed).toMatch(/^[a-f0-9]{16}$/)
  })
})
