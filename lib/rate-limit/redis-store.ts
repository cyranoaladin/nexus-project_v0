import { createClient } from 'redis'

import type { DistributedRateLimitStore, RateLimitDecision } from './types'

const FIXED_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`

const IDEMPOTENT_FIXED_WINDOW_SCRIPT = `
local existing = redis.call('GET', KEYS[2])
if existing then
  local ttl = redis.call('PTTL', KEYS[2])
  return {tonumber(existing), ttl}
end
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
redis.call('SET', KEYS[2], count, 'PX', ttl)
return {count, ttl}
`

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

function commandTimeoutMs(): number {
  return boundedInteger(process.env.RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS, 1_500, 50, 10_000)
}

function connectTimeoutMs(): number {
  return boundedInteger(process.env.RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS, 1_500, 50, 10_000)
}

function reconnectDelay(retries: number): number | Error {
  const maxRetries = boundedInteger(process.env.RATE_LIMIT_REDIS_MAX_RETRIES, 2, 0, 10)
  if (retries > maxRetries) return new Error('Redis rate-limit reconnect limit reached')
  return Math.min(100 * (retries + 1), 500)
}

export class RedisStore implements DistributedRateLimitStore {
  private readonly client: ReturnType<typeof createClient>
  private connecting?: Promise<void>

  constructor(url: string) {
    this.client = createClient({
      url,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: connectTimeoutMs(),
        reconnectStrategy: reconnectDelay,
      },
    })
    this.client.on('error', () => {
      // The caller receives a reduced fail-closed error. Never log the Redis URL.
    })
  }

  async increment(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    return this.evaluateScript(FIXED_WINDOW_SCRIPT, [key], limit, windowMs)
  }

  async incrementOnce(
    key: string,
    idempotencyKey: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitDecision> {
    return this.evaluateScript(
      IDEMPOTENT_FIXED_WINDOW_SCRIPT,
      [key, idempotencyKey],
      limit,
      windowMs,
    )
  }

  private async evaluateScript(
    script: string,
    keys: readonly string[],
    limit: number,
    windowMs: number,
  ): Promise<RateLimitDecision> {
    let result: unknown
    try {
      await this.ensureConnected()
      result = await this.withDeadline(
        this.client.eval(script, {
          keys: [...keys],
          arguments: [String(windowMs)],
        }),
      )
    } catch (error) {
      if (this.client.isOpen) this.client.disconnect()
      throw error
    }

    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error('Redis returned an invalid rate-limit result')
    }
    const count = Number(result[0])
    const ttl = Number(result[1])
    if (!Number.isFinite(count) || !Number.isFinite(ttl) || ttl <= 0) {
      throw new Error('Redis returned an invalid rate-limit TTL')
    }

    return {
      success: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt: Date.now() + ttl,
    }
  }

  async close(): Promise<void> {
    if (this.client.isOpen) await this.client.quit()
  }

  /** Bounded read-only dependency probe, without a rate-limit counter. */
  async probe(): Promise<void> {
    try {
      await this.ensureConnected()
      const response = await this.withDeadline(this.client.ping())
      if (response !== 'PONG') throw new Error('Redis readiness response invalid')
    } catch (error) {
      if (this.client.isOpen) this.client.disconnect()
      throw error
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.connecting) return this.connecting
    if (this.client.isOpen) return
    const connecting = this.withDeadline(this.client.connect()).then(() => undefined)
    this.connecting = connecting
    try { await connecting }
    finally { if (this.connecting === connecting) this.connecting = undefined }
  }

  async destroy(): Promise<void> {
    await this.close()
  }

  private async withDeadline<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Redis rate-limit command timed out')),
        commandTimeoutMs(),
      )
      timer.unref?.()
    })
    try {
      return await Promise.race([operation, timeout])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}
