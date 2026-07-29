import { createClient, type RedisClientType } from 'redis';

/**
 * Redis-backed store for VPS-local distributed rate limiting.
 *
 * Designed for a local Redis instance reachable through REDIS_URL. The store
 * connects lazily so importing the rate-limit module never opens a socket.
 */
export class RedisStore {
  private readonly url: string;
  private readonly timeoutMs: number;
  private client: RedisClientType | null = null;
  private connecting: Promise<RedisClientType> | null = null;

  constructor(url: string, options: Readonly<{ timeoutMs?: number }> = {}) {
    this.url = url;
    this.timeoutMs = options.timeoutMs ?? 1_500;
  }

  private async getClient(): Promise<RedisClientType> {
    if (this.client?.isOpen) return this.client;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const client = createClient({
        url: this.url,
        socket: {
          connectTimeout: this.timeoutMs,
          reconnectStrategy: false,
        },
        disableOfflineQueue: true,
      }) as RedisClientType;
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
    options: Readonly<{ signal?: AbortSignal }> = {},
  ): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    resetAt: number;
  }> {
    const client = await this.getClient();
    const commandOptions = options.signal
      ? client.commandOptions({ signal: options.signal })
      : null;
    const count = commandOptions
      ? await client.incr(commandOptions, key)
      : await client.incr(key);
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    if (commandOptions) {
      await client.expire(commandOptions, key, windowSeconds, 'NX');
    } else {
      await client.expire(key, windowSeconds, 'NX');
    }

    const ttlSeconds = commandOptions
      ? await client.ttl(commandOptions, key)
      : await client.ttl(key);
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
