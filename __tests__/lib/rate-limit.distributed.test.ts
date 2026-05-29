import { NextRequest } from 'next/server';
import {
  _resetStoreForTests,
  checkRateLimit,
  checkRateLimitAsync,
  getRateLimitRuntimeMode,
} from '@/lib/rate-limit';
import { RedisStore } from '@/lib/rate-limit/redis-store';

const mockRedisIncrement = jest.fn();
const mockRedisExpire = jest.fn();
const mockRedisTtl = jest.fn();
const mockRedisQuit = jest.fn();
const mockRedisOn = jest.fn();
const mockRedisConnect = jest.fn();

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    isOpen: false,
    connect: mockRedisConnect,
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
    Object.assign(process.env, { NODE_ENV: 'test' });
    mockRedisIncrement.mockReset();
    mockRedisExpire.mockReset();
    mockRedisTtl.mockReset();
    mockRedisQuit.mockReset();
    mockRedisOn.mockReset();
    mockRedisConnect.mockReset();
    mockRedisConnect.mockResolvedValue(undefined);
  });

  afterEach(() => {
    _resetStoreForTests();
    restoreEnv('NODE_ENV');
    restoreEnv('RATE_LIMIT_DISABLE');
    restoreEnv('REDIS_URL');
    restoreEnv('UPSTASH_REDIS_REST_URL');
    restoreEnv('UPSTASH_REDIS_REST_TOKEN');
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
    expect(mockRedisIncrement).toHaveBeenCalledWith(expect.stringContaining('api:'));
    expect(mockRedisExpire).toHaveBeenCalledWith(expect.any(String), 60, 'NX');
    expect(mockRedisTtl).toHaveBeenCalledWith(expect.any(String));
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
