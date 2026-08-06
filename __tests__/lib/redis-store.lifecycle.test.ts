const mockConnect = jest.fn(async () => undefined)
const mockDisconnect = jest.fn()
const mockQuit = jest.fn(async () => undefined)
const mockOn = jest.fn()
const mockEvalCommand = jest.fn<Promise<unknown>, unknown[]>()
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
    }))
    process.env.RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS = '20'
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
})
