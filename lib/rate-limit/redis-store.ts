import { createClient, type RedisClientType } from 'redis';

/**
 * Redis-backed store for VPS-local distributed rate limiting.
 *
 * Designed for a local Redis instance reachable through REDIS_URL. The store
 * connects lazily so importing the rate-limit module never opens a socket.
 */
export class RedisStore {
  private readonly url: string;
  private client: RedisClientType | null = null;
  private connecting: Promise<RedisClientType> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  private async getClient(): Promise<RedisClientType> {
    if (this.client?.isOpen) return this.client;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const client = createClient({ url: this.url }) as RedisClientType;
      client.on('error', () => {
        // Errors are surfaced through command failures and handled by caller.
      });
      await client.connect();
      this.client = client;
      this.connecting = null;
      return client;
    })();

    try {
      return await this.connecting;
    } catch (error) {
      this.connecting = null;
      throw error;
    }
  }

  async increment(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    resetAt: number;
  }> {
    const client = await this.getClient();
    const count = await client.incr(key);
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    await client.expire(key, windowSeconds, 'NX');

    const ttlSeconds = await client.ttl(key);
    const ttlMs = Number.isFinite(ttlSeconds) && ttlSeconds > 0
      ? ttlSeconds * 1000
      : windowMs;
    const remaining = Math.max(0, limit - count);

    return {
      success: count <= limit,
      limit,
      remaining,
      resetAt: Date.now() + ttlMs,
    };
  }

  async destroy(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.connecting = null;
    if (client?.isOpen) {
      await client.quit();
    }
  }
}
