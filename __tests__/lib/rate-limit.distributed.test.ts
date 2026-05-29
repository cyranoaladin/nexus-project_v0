import { NextRequest } from 'next/server';
import {
  _resetStoreForTests,
  checkRateLimit,
  checkRateLimitAsync,
  getRateLimitRuntimeMode,
} from '@/lib/rate-limit';

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
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    Object.assign(process.env, { NODE_ENV: 'test' });
  });

  afterEach(() => {
    _resetStoreForTests();
    restoreEnv('NODE_ENV');
    restoreEnv('RATE_LIMIT_DISABLE');
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
});
