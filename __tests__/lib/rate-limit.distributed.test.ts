import { NextRequest } from 'next/server';
import {
  _resetStoreForTests,
  checkRateLimit,
  checkRateLimitAsync,
  getDistributedRateLimitTimeoutMs,
  getRateLimitRuntimeMode,
  guardRateLimitAsync,
} from '@/lib/rate-limit';
import { RedisStore } from '@/lib/rate-limit/redis-store';
import { createClient } from 'redis';

const mockRedisIncrement = jest.fn();
const mockRedisExpire = jest.fn();
const mockRedisTtl = jest.fn();
const mockRedisQuit = jest.fn();
const mockRedisOn = jest.fn();
const mockRedisConnect = jest.fn();
const mockRedisCommandOptions = jest.fn((options: unknown) => options);

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    isOpen: false,
    connect: mockRedisConnect,
    commandOptions: mockRedisCommandOptions,
    incr: mockRedisIncrement,
    expire: mockRedisExpire,
    ttl: mockRedisTtl,
    quit: mockRedisQuit,
    on: mockRedisOn,
  })),
}));

function makeRequest(ip = '203.0.113.10'): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', {
    headers: { 'x-forwarded-for': ip },
  });
}

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  RATE_LIMIT_DISABLE: process.env.RATE_LIMIT_DISABLE,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  REDIS_URL: process.env.REDIS_URL,
  RATE_LIMIT_DISTRIBUTED_TIMEOUT_MS: process.env.RATE_LIMIT_DISTRIBUTED_TIMEOUT_MS,
};

function restoreEnv(name: keyof typeof ORIGINAL_ENV) {
  const value = ORIGINAL_ENV[name];
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  Object.assign(process.env, { [name]: value });
}

describe('distributed/public rate limit hardening', () => {
  beforeEach(() => {
    _resetStoreForTests();
    jest.restoreAllMocks();
    delete process.env.RATE_LIMIT_DISABLE;
    delete process.env.REDIS_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.RATE_LIMIT_DISTRIBUTED_TIMEOUT_MS;
    Object.assign(process.env, { NODE_ENV: 'test' });
    mockRedisIncrement.mockReset();
    mockRedisExpire.mockReset();
    mockRedisTtl.mockReset();
    mockRedisQuit.mockReset();
    mockRedisOn.mockReset();
    mockRedisConnect.mockReset();
    mockRedisCommandOptions.mockClear();
    mockRedisConnect.mockResolvedValue(undefined);
  });

  afterEach(() => {
    _resetStoreForTests();
    restoreEnv('NODE_ENV');
    restoreEnv('RATE_LIMIT_DISABLE');
    restoreEnv('REDIS_URL');
    restoreEnv('UPSTASH_REDIS_REST_URL');
    restoreEnv('UPSTASH_REDIS_REST_TOKEN');
    restoreEnv('RATE_LIMIT_DISTRIBUTED_TIMEOUT_MS');
  });

  it('does not allow RATE_LIMIT_DISABLE=1 to bypass protection in production', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    process.env.RATE_LIMIT_DISABLE = '1';

    const req = makeRequest('203.0.113.11');
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(req, { preset: 'auth' }).success).toBe(true);
    }

    expect(checkRateLimit(req, { preset: 'auth' }).success).toBe(false);
  });

  it('still allows RATE_LIMIT_DISABLE=1 bypass in test/dev environments', () => {
    Object.assign(process.env, { NODE_ENV: 'test' });
    process.env.RATE_LIMIT_DISABLE = '1';

    const req = makeRequest('203.0.113.12');
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit(req, { preset: 'auth' }).success).toBe(true);
    }
  });

  it('selects upstash mode when both Upstash REST variables are present', () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example-upstash.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    expect(getRateLimitRuntimeMode()).toBe('upstash');
  });

  it('selects redis mode when REDIS_URL is present', () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';

    expect(getRateLimitRuntimeMode()).toBe('redis');
  });

  it('prioritizes redis mode over Upstash when both are configured', () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.UPSTASH_REDIS_REST_URL = 'https://example-upstash.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    expect(getRateLimitRuntimeMode()).toBe('redis');
  });

  it('uses only validated bounded distributed timeout configuration', () => {
    process.env.RATE_LIMIT_DISTRIBUTED_TIMEOUT_MS = '250';
    expect(getDistributedRateLimitTimeoutMs()).toBe(250);

    for (const invalid of ['not-a-number', '99', '10001', '250.5', '']) {
      process.env.RATE_LIMIT_DISTRIBUTED_TIMEOUT_MS = invalid;
      expect(getDistributedRateLimitTimeoutMs()).toBe(1_500);
    }
  });

  it('uses the configured Upstash REST backend for async checks', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example-upstash.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ result: 1 }, { result: 'OK' }, { result: 60_000 }],
    } as Response);

    const result = await checkRateLimitAsync(makeRequest('203.0.113.13'), { preset: 'api' });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example-upstash.test/pipeline',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('uses the configured Redis backend for async checks', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    mockRedisIncrement.mockResolvedValueOnce(1);
    mockRedisExpire.mockResolvedValueOnce(true);
    mockRedisTtl.mockResolvedValueOnce(60);

    const result = await checkRateLimitAsync(makeRequest('203.0.113.14'), { preset: 'api' });

    expect(result.success).toBe(true);
    expect(mockRedisConnect).toHaveBeenCalledTimes(1);
    expect(mockRedisIncrement).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
      expect.stringContaining('api:'),
    );
    expect(mockRedisExpire).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
      expect.any(String),
      60,
      'NX',
    );
    expect(mockRedisTtl).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
      expect.any(String),
    );
  });

  it('keys distributed counters with the trusted proxy-appended IP, not a forged prefix', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    mockRedisIncrement.mockResolvedValueOnce(1);
    mockRedisExpire.mockResolvedValueOnce(true);
    mockRedisTtl.mockResolvedValueOnce(60);

    const request = makeRequest('198.51.100.66, 203.0.113.77');
    await checkRateLimitAsync(request, { preset: 'api' });

    const redisKey = String(mockRedisIncrement.mock.calls[0]?.[1]);
    expect(redisKey).toContain('203.0.113.77');
    expect(redisKey).not.toContain('198.51.100.66');
  });

  it('falls back to memory when Redis is unavailable', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    mockRedisIncrement.mockRejectedValueOnce(new Error('redis unavailable'));

    const req = makeRequest('203.0.113.15');
    const result = await checkRateLimitAsync(req, { preset: 'auth' });

    expect(result.success).toBe(true);
    for (let i = 0; i < 4; i++) {
      expect(checkRateLimit(req, { preset: 'auth' }).success).toBe(true);
    }
    expect(checkRateLimit(req, { preset: 'auth' }).success).toBe(false);
  });

  it('fails closed in production when a required distributed store is not configured', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });

    const result = await checkRateLimitAsync(makeRequest('203.0.113.16'), {
      preset: 'api',
      requireDistributed: true,
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      unavailable: true,
    }));
  });

  it('fails closed in production when the configured required store fails', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    mockRedisIncrement.mockRejectedValueOnce(new Error('redis unavailable'));

    const result = await checkRateLimitAsync(makeRequest('203.0.113.17'), {
      preset: 'auth',
      requireDistributed: true,
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      unavailable: true,
    }));
  });

  it('fails closed within the configured bound when Redis never resolves without memory fallback', async () => {
    jest.useFakeTimers();
    try {
      Object.assign(process.env, { NODE_ENV: 'production' });
      process.env.REDIS_URL = 'redis://127.0.0.1:6379';
      process.env.RATE_LIMIT_DISTRIBUTED_TIMEOUT_MS = '250';
      let observedSignal: AbortSignal | undefined;
      mockRedisIncrement.mockImplementationOnce((options: { signal?: AbortSignal }) => {
        observedSignal = options.signal;
        return new Promise((_resolve, reject) => {
          observedSignal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          }, { once: true });
        });
      });

      const request = makeRequest('203.0.113.177');
      let settled: Awaited<ReturnType<typeof checkRateLimitAsync>> | undefined;
      void checkRateLimitAsync(request, {
        preset: 'auth',
        requireDistributed: true,
      }).then((value) => {
        settled = value;
      });

      await jest.advanceTimersByTimeAsync(250);

      expect(settled).toEqual(expect.objectContaining({
        success: false,
        unavailable: true,
      }));
      expect(observedSignal?.aborted).toBe(true);
      expect(createClient).toHaveBeenLastCalledWith({
        url: 'redis://127.0.0.1:6379',
        socket: {
          connectTimeout: 250,
          reconnectStrategy: false,
        },
        disableOfflineQueue: true,
      });
      expect(checkRateLimit(request, { preset: 'auth' }).remaining).toBe(4);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('aborts a hanging Upstash request and returns a sober 503 within the configured bound', async () => {
    jest.useFakeTimers();
    try {
      Object.assign(process.env, { NODE_ENV: 'production' });
      process.env.UPSTASH_REDIS_REST_URL = 'https://example-upstash.test';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
      process.env.RATE_LIMIT_DISTRIBUTED_TIMEOUT_MS = '250';
      let observedSignal: AbortSignal | undefined;
      jest.spyOn(global, 'fetch').mockImplementation((_input, init) => {
        observedSignal = init?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          observedSignal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          }, { once: true });
        });
      });

      let response: Awaited<ReturnType<typeof guardRateLimitAsync>> | undefined;
      void guardRateLimitAsync(makeRequest('203.0.113.178'), {
        preset: 'api',
        requireDistributed: true,
      }).then((value) => {
        response = value;
      });

      await jest.advanceTimersByTimeAsync(250);

      expect(observedSignal?.aborted).toBe(true);
      expect(response?.status).toBe(503);
      await expect(response?.json()).resolves.toEqual({
        ok: false,
        error: {
          code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
          message: 'Service temporairement indisponible. Veuillez réessayer plus tard.',
        },
      });
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('never lets the production bypass override required distributed mode', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    process.env.RATE_LIMIT_DISABLE = '1';

    const result = await checkRateLimitAsync(makeRequest('203.0.113.18'), {
      preset: 'api',
      requireDistributed: true,
    });

    expect(result.unavailable).toBe(true);
  });

  it('returns a stable sober 503 without infrastructure details when required protection is unavailable', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });

    const response = await guardRateLimitAsync(makeRequest('203.0.113.19'), {
      preset: 'api',
      requireDistributed: true,
    });

    expect(response?.status).toBe(503);
    const body = await response?.json();
    expect(body).toEqual({
      ok: false,
      error: {
        code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
        message: 'Service temporairement indisponible. Veuillez réessayer plus tard.',
      },
    });
    expect(JSON.stringify(body).toLowerCase()).not.toMatch(
      /redis|upstash|memory/,
    );
  });

  it('increments Redis counters with expiration semantics', async () => {
    mockRedisIncrement.mockResolvedValueOnce(6);
    mockRedisExpire.mockResolvedValueOnce(false);
    mockRedisTtl.mockResolvedValueOnce(120);

    const store = new RedisStore('redis://127.0.0.1:6379');
    const result = await store.increment('rl:test', 5, 180_000);

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(mockRedisExpire).toHaveBeenCalledWith('rl:test', 180, 'NX');
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });
});
