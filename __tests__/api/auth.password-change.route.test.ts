jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));
jest.mock('@/lib/auth/change-v1-password', () => ({ changeV1Password: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn() }));

import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getToken } from 'next-auth/jwt';
import { changeV1Password } from '@/lib/auth/change-v1-password';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { POST } from '@/app/api/auth/password-change/route';

const user = { id: 'synthetic-v1-parent', role: 'PARENT', authority: 'V1' };
const input = { currentPassword: 'change_me_before', newPassword: 'change_me_after' };
function request(body: unknown = input, origin = 'http://localhost:3000') {
  return new NextRequest('http://localhost:3000/api/auth/password-change', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  delete process.env.AUTH_URL;
  process.env.NEXTAUTH_SECRET = 'synthetic-v1-route-auth-secret-at-least-32';
  jest.mocked(auth).mockResolvedValue({ user } as Awaited<ReturnType<typeof auth>>);
  jest.mocked(getToken).mockResolvedValue({ id: user.id, role: 'PARENT', authority: 'V1', sessionVersion: 4 });
  jest.mocked(guardSensitiveRateLimit).mockResolvedValue(null);
  jest.mocked(changeV1Password).mockResolvedValue(undefined);
});

test('changes only the session identity and never exposes the JWT version or credentials', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, data: { sessionsRevoked: true } });
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(changeV1Password).toHaveBeenCalledWith(expect.anything(), {
    userId: user.id, role: 'PARENT', authority: 'V1', sessionVersion: 4,
  }, input, expect.stringMatching(/^[0-9a-f-]{36}$/));
  expect(guardSensitiveRateLimit).toHaveBeenCalledWith(expect.anything(), {
    scope: 'v1-password-change', identity: user.id,
  });
});

test('rejects a target identity supplied in the body', async () => {
  const response = await POST(request({ ...input, userId: 'another-account' }));
  expect(response.status).toBe(400);
  expect(changeV1Password).not.toHaveBeenCalled();
});

test('rejects a Core-v2 session instead of mutating its V1 mirror', async () => {
  jest.mocked(auth).mockResolvedValue({ user: { ...user, authority: 'CORE_V2' } } as Awaited<ReturnType<typeof auth>>);
  expect((await POST(request())).status).toBe(403);
  expect(changeV1Password).not.toHaveBeenCalled();
});

test.each([
  { id: user.id, role: 'PARENT', authority: 'V1' },
  { id: 'another-account', role: 'PARENT', authority: 'V1', sessionVersion: 4 },
  { id: user.id, role: 'ADMIN', authority: 'V1', sessionVersion: 4 },
] as const)('rejects a missing version or mismatched private JWT snapshot', async (token) => {
  jest.mocked(getToken).mockResolvedValue(token);
  expect((await POST(request())).status).toBe(401);
  expect(changeV1Password).not.toHaveBeenCalled();
});

test('bounds the actual body even without Content-Length', async () => {
  const response = await POST(request({ ...input, extra: 'x'.repeat(5000) }));
  expect(response.status).toBe(413);
  expect(changeV1Password).not.toHaveBeenCalled();
});

test('rejects a foreign origin under production CSRF rules', async () => {
  const previous = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: 'production' });
  try { expect((await POST(request(input, 'https://foreign.invalid'))).status).toBe(403); }
  finally { Object.assign(process.env, { NODE_ENV: previous }); }
  expect(changeV1Password).not.toHaveBeenCalled();
});
