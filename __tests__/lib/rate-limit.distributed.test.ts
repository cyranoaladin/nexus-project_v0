import {
  getRateLimitRuntimeMode,
  guardRateLimitAsync,
  resetRateLimitRuntimeForTests,
  shutdownRateLimitRuntime,
} from '@/lib/rate-limit'
import { RedisStore } from '@/lib/rate-limit/redis-store'
import { createClient } from 'redis'

jest.mock('redis', () => ({ createClient: jest.fn() }))

let redisOpen = false
const mockRedisEval = jest.fn()
const mockRedisQuit = jest.fn(async () => { redisOpen = false })
const mockRedisDisconnect = jest.fn(() => { redisOpen = false })
const mockRedisOn = jest.fn()
const mockRedisConnect = jest.fn(async () => { redisOpen = true })
const mockRedisCreateClient = createClient as jest.Mock

describe('distributed rate limiting', () => {
  const original = { ...process.env }

  beforeEach(() => {
    redisOpen = false
    jest.clearAllMocks()
    mockRedisCreateClient.mockImplementation(() => ({
      get isOpen() { return redisOpen },
      connect: mockRedisConnect,
      eval: mockRedisEval,
      quit: mockRedisQuit,
      disconnect: mockRedisDisconnect,
      on: mockRedisOn,
    }))
    resetRateLimitRuntimeForTests()
    Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: 'test' })
    process.env.RATE_LIMIT_BACKEND = 'redis'
    process.env.REDIS_URL = 'redis://127.0.0.1:6379'
    process.env.RATE_LIMIT_KEY_SECRET = 's3-test-hmac-secret-at-least-thirty-two-bytes'
    process.env.RATE_LIMIT_KEY_NAMESPACE = 'test'
    process.env.RATE_LIMIT_TRUST_PROXY_HOPS = '1'
  })

  afterAll(async () => {
    await shutdownRateLimitRuntime()
    process.env = original
  })

  it('requires an explicit supported backend', () => {
    delete process.env.RATE_LIMIT_BACKEND
    expect(getRateLimitRuntimeMode()).toBe('invalid')
    process.env.RATE_LIMIT_BACKEND = 'upstash'
    expect(getRateLimitRuntimeMode()).toBe('invalid')
    process.env.RATE_LIMIT_BACKEND = 'redis'
    expect(getRateLimitRuntimeMode()).toBe('redis')
  })

  it('permits memory only when explicitly selected outside production', () => {
    process.env.RATE_LIMIT_BACKEND = 'memory'
    expect(getRateLimitRuntimeMode()).toBe('memory')
    Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: 'production' })
    expect(getRateLimitRuntimeMode()).toBe('invalid')
  })

  it('shares one Redis client per process and awaits the atomic decision', async () => {
    mockRedisEval.mockResolvedValue([1, 60_000])
    const request = new Request('https://nexus.test/api/auth/signin', {
      headers: { 'x-forwarded-for': '198.51.100.20' },
    })

    await expect(guardRateLimitAsync(request, { preset: 'auth', keySuffix: 'login' })).resolves.toBeNull()
    await expect(guardRateLimitAsync(request, { preset: 'auth', keySuffix: 'login' })).resolves.toBeNull()

    expect(mockRedisCreateClient).toHaveBeenCalledTimes(1)
    expect(mockRedisConnect).toHaveBeenCalledTimes(1)
    expect(mockRedisEval).toHaveBeenCalledTimes(2)
  })

  it('fails closed without exposing backend details', async () => {
    mockRedisEval.mockRejectedValue(new Error('redis://user:secret@private:6379'))
    const request = new Request('https://nexus.test/api/auth/signin', {
      headers: { 'x-forwarded-for': '198.51.100.20' },
    })

    const response = await guardRateLimitAsync(request, { preset: 'auth', keySuffix: 'login' })
    expect(response?.status).toBe(503)
    expect(response?.headers.get('cache-control')).toContain('no-store')
    const body = await response?.text()
    expect(body).not.toContain('redis')
    expect(body).not.toContain('secret')
  })

  it('returns a bounded fixed-window decision from Redis', async () => {
    mockRedisEval.mockResolvedValue([6, 120_000])
    const store = new RedisStore('redis://127.0.0.1:6379')

    await expect(store.increment('rl:v1:test:login:ip:digest', 5, 120_000)).resolves.toEqual(
      expect.objectContaining({ success: false, limit: 5, remaining: 0 }),
    )
    expect(mockRedisEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR'"),
      expect.objectContaining({
        keys: ['rl:v1:test:login:ip:digest'],
        arguments: ['120000'],
      }),
    )
  })
})
