/** @jest-environment node */
import { NextRequest } from 'next/server';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { resetRateLimitRuntimeForTests } from '@/lib/rate-limit/runtime';
const original = { ...process.env };
beforeEach(() => {
  process.env.RATE_LIMIT_BACKEND = 'memory';
  process.env.RATE_LIMIT_KEY_SECRET = 'change_me_synthetic_rate_limit_secret_32_bytes';
  process.env.RATE_LIMIT_KEY_NAMESPACE = 'password-change-unit-test';
  process.env.RATE_LIMIT_TRUST_PROXY_HOPS = '1';
  resetRateLimitRuntimeForTests();
});
afterEach(() => { resetRateLimitRuntimeForTests(); process.env = { ...original }; });
function request(ip: string) {
  return new NextRequest('http://localhost/api/v2/auth/password-change', {
    method: 'POST', headers: { 'x-forwarded-for': ip },
  });
}
test.each(['core-v2-password-change', 'v1-password-change'] as const)('%s: changing source IP cannot bypass the authenticated identity attempt limit', async (scope) => {
  for (let index = 0; index < 5; index++) {
    expect(await guardSensitiveRateLimit(request(`198.51.100.${index + 1}`), {
      scope, identity: 'synthetic-account',
    })).toBeNull();
  }
  const blocked = await guardSensitiveRateLimit(request('198.51.100.6'), {
    scope, identity: 'synthetic-account',
  });
  expect(blocked?.status).toBe(429);
  expect(blocked?.headers.get('retry-after')).not.toBeNull();
});
test.each(['core-v2-password-change', 'v1-password-change'] as const)('%s: changing accounts cannot bypass the IP attempt limit', async (scope) => {
  for (let index = 0; index < 30; index++) {
    expect(await guardSensitiveRateLimit(request('198.51.100.20'), {
      scope, identity: `synthetic-account-${index}`,
    })).toBeNull();
  }
  expect((await guardSensitiveRateLimit(request('198.51.100.20'), {
    scope, identity: 'synthetic-account-next',
  }))?.status).toBe(429);
});
