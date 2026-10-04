const mockConnect = jest.fn(async () => undefined)
const mockDisconnect = jest.fn()
const mockQuit = jest.fn(async () => undefined)
const mockOn = jest.fn()
const mockEvalCommand = jest.fn<Promise<unknown>, unknown[]>()
const mockPing = jest.fn<Promise<string>, unknown[]>()
import { RedisStore } from '@/lib/rate-limit/redis-store'
import { createClient } from 'redis'

jest.mock('redis', () => ({ createClient: jest.fn() }))

const mockCreateClient = createClient as jest.Mock

describe('RedisStore lifecycle', () => {
  const originalTimeout = process.env.RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS

  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateClient.mockImplementation(() => ({
      isOpen: true,
      connect: mockConnect,
      disconnect: mockDisconnect,
      quit: mockQuit,
      on: mockOn,
      eval: mockEvalCommand,
      ping: mockPing,
    }))
    process.env.RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS = '20'
    mockPing.mockResolvedValue('PONG')
    mockConnect.mockResolvedValue(undefined)
  })

  afterAll(() => {
    if (originalTimeout === undefined) delete process.env.RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS
    else process.env.RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS = originalTimeout
  })

  it('configures bounded connection and retry behavior without an offline queue', () => {
    new RedisStore('redis://127.0.0.1:6379')

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'redis://127.0.0.1:6379',
        disableOfflineQueue: true,
        socket: expect.objectContaining({
          connectTimeout: expect.any(Number),
          reconnectStrategy: expect.any(Function),
        }),
      }),
    )
    const options = mockCreateClient.mock.calls[0]?.[0] as {
      socket: { connectTimeout: number; reconnectStrategy: (retries: number) => number | Error }
    }
    expect(options.socket.connectTimeout).toBeGreaterThan(0)
    expect(options.socket.reconnectStrategy(0)).toEqual(expect.any(Number))
    expect(options.socket.reconnectStrategy(100)).toBeInstanceOf(Error)
  })

  it('fails closed within the configured command deadline', async () => {
    mockEvalCommand.mockImplementation(() => new Promise(() => undefined))
    const store = new RedisStore('redis://127.0.0.1:6379')

    await expect(store.increment('rl:v1:test:scope:ip:key', 1, 1_000)).rejects.toThrow(
      'Redis rate-limit command timed out',
    )
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })

  it.each([-1, -2])('fails closed for an invalid Redis PTTL (%i)', async (ttl) => {
    mockEvalCommand.mockResolvedValue([1, ttl])
    const store = new RedisStore('redis://127.0.0.1:6379')

    await expect(store.increment('rl:v1:test:scope:ip:key', 1, 1_000)).rejects.toThrow(
      'Redis returned an invalid rate-limit TTL',
    )
  })

  it('probes Redis without incrementing any business counter', async () => {
    const store = new RedisStore('redis://127.0.0.1:6379')
    await store.probe()
    expect(mockPing).toHaveBeenCalledTimes(1)
    expect(mockEvalCommand).not.toHaveBeenCalled()
  })

  it('rejects a readiness response other than PONG', async () => {
    mockPing.mockResolvedValue('INVALID')
    const store = new RedisStore('redis://127.0.0.1:6379')
    await expect(store.probe()).rejects.toThrow('Redis readiness response invalid')
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })

  it('bounds an unavailable readiness probe with the command deadline', async () => {
    process.env.RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS = '50'
    mockPing.mockImplementation(() => new Promise(() => undefined))
    const store = new RedisStore('redis://127.0.0.1:6379')
    await expect(store.probe()).rejects.toThrow('Redis rate-limit command timed out')
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })

  it('shares an in-flight connection between readiness and a business decision', async () => {
    let connected = false
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    mockConnect.mockImplementation(async () => { await barrier; connected = true; return undefined })
    mockEvalCommand.mockResolvedValue([1, 1_000])
    mockCreateClient.mockImplementation(() => ({
      get isOpen() { return connected }, connect: mockConnect, disconnect: mockDisconnect,
      quit: mockQuit, on: mockOn, eval: mockEvalCommand, ping: mockPing,
    }))
    const store = new RedisStore('redis://127.0.0.1:6379')
    const probe = store.probe()
    const decision = store.increment('synthetic-readiness-race', 1, 1_000)
    try { expect(mockConnect).toHaveBeenCalledTimes(1) }
    finally { release(); await Promise.all([probe, decision]) }
    expect(mockPing).toHaveBeenCalledTimes(1)
    expect(mockEvalCommand).toHaveBeenCalledTimes(1)
  })
})
