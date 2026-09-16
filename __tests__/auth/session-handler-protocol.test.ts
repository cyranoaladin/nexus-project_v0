/** @jest-environment node */
import { NextRequest } from 'next/server';
import { encode } from 'next-auth/jwt';
import { randomBytes, webcrypto } from 'node:crypto';

jest.unmock('@/auth');
jest.unmock('next-auth');
jest.unmock('next-auth/providers/credentials');
jest.unmock('@auth/core/providers/credentials');
jest.mock('next/headers', () => ({ headers: jest.fn() }));

const secret = randomBytes(32).toString('hex');
const origin = 'https://auth-handler.example.test';
const cookieName = '__Secure-authjs.session-token';
const user = (id = 'synthetic-parent-a', sessionVersion = 0) => ({ id, role: 'PARENT', activatedAt: new Date('2026-01-01T00:00:00Z'), sessionVersion });
let GET: (request: NextRequest) => Promise<Response>;
let POST: (request: NextRequest) => Promise<Response>;
let lookup: jest.Mock;
const original = Object.fromEntries(['AUTH_SECRET', 'AUTH_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'].map(key => [key, process.env[key]]));

async function request(id = 'synthetic-parent-a') {
  const jwt = await encode({ secret, salt: cookieName, maxAge: 3600, token: { id, role: 'PARENT', sessionVersion: 0 } });
  return new NextRequest(`${origin}/api/auth/session`, { headers: { cookie: `${cookieName}=${jwt}` } });
}

beforeAll(async () => {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET = secret;
  process.env.AUTH_URL = process.env.NEXTAUTH_URL = `${origin}/api/auth`;
  const { prisma } = await import('@/lib/prisma');
  lookup = prisma.user.findUnique as jest.Mock;
  ({ GET, POST } = await import('@/app/api/auth/[...nextauth]/route'));
});
beforeEach(() => { lookup.mockReset(); });
afterAll(() => { for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });

it('returns unavailable without deleting or renewing cookies, then accepts the same credential after recovery', async () => {
  lookup.mockRejectedValueOnce(new Error('synthetic database outage'));
  const originalRequest = await request();
  const unavailable = await GET(new NextRequest(originalRequest));
  expect(unavailable.status).toBe(503);
  expect(unavailable.headers.get('cache-control')).toContain('no-store');
  expect(unavailable.headers.get('set-cookie')).toBeNull();
  expect(await unavailable.json()).toEqual({ error: 'SESSION_VERIFICATION_UNAVAILABLE' });
  expect(lookup).toHaveBeenCalledTimes(1);
  lookup.mockResolvedValueOnce(user());
  const recovered = await GET(originalRequest);
  expect(recovered.status).toBe(200);
  expect((await recovered.json()).user.id).toBe('synthetic-parent-a');
});

it.each([null, user('synthetic-parent-a', 1)])('preserves positive revocation and normal cookie retirement', async row => {
  lookup.mockResolvedValueOnce(row);
  const result = await GET(await request());
  expect(result.status).toBe(200);
  expect(await result.json()).toBeNull();
  expect(result.headers.get('set-cookie')).toContain(`${cookieName}=`);
  expect(result.headers.get('set-cookie')).toContain('Max-Age=0');
});

it.each([true, false])('isolates concurrent unavailable and valid sessions (outage first=%s)', async outageFirst => {
  let rejectA!: (cause: Error) => void;
  let resolveB!: (value: ReturnType<typeof user>) => void;
  let started!: () => void;
  const bothStarted = new Promise<void>(resolve => { started = resolve; });
  let count = 0;
  lookup.mockImplementation(({ where }: { where: { id: string } }) => {
    const result = where.id.endsWith('-a') ? new Promise((_resolve, reject) => { rejectA = reject; })
      : new Promise(resolve => { resolveB = resolve; });
    if (++count === 2) started();
    return result;
  });
  const a = GET(await request());
  const b = GET(await request('synthetic-parent-b'));
  await bothStarted;
  if (outageFirst) { rejectA(new Error('synthetic outage')); await a; resolveB(user('synthetic-parent-b')); }
  else { resolveB(user('synthetic-parent-b')); await b; rejectA(new Error('synthetic outage')); }
  const [failed, valid] = await Promise.all([a, b]);
  expect(failed.status).toBe(503);
  expect(failed.headers.get('set-cookie')).toBeNull();
  expect(valid.status).toBe(200);
  expect((await valid.json()).user.id).toBe('synthetic-parent-b');
  lookup.mockResolvedValueOnce(user());
  expect((await GET(await request())).status).toBe(200);
});

it('does not turn a CSRF-verified provider update outage into logout either', async () => {
  const csrf = await GET(new NextRequest(`${origin}/api/auth/csrf`));
  const { csrfToken } = await csrf.json();
  const sessionRequest = await request();
  const cookies = csrf.headers.getSetCookie().map(cookie => cookie.split(';')[0]);
  cookies.push(sessionRequest.headers.get('cookie')!);
  lookup.mockRejectedValueOnce(new Error('synthetic outage'));
  const result = await POST(new NextRequest(`${origin}/api/auth/session`, {
    method: 'POST', headers: { cookie: cookies.join('; '), 'content-type': 'application/json' },
    body: JSON.stringify({ csrfToken, data: {} }),
  }));
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(result.status).toBe(503);
  expect(result.headers.get('set-cookie')).toBeNull();
});

it('does not let server layouts mistake a database outage for positive session absence', async () => {
  const { headers } = await import('next/headers');
  const { auth } = await import('@/auth');
  (headers as jest.Mock).mockResolvedValue((await request()).headers);
  lookup.mockRejectedValueOnce(new Error('synthetic outage'));
  await expect(auth()).rejects.toThrow('SESSION_VERIFICATION_UNAVAILABLE');
  lookup.mockResolvedValueOnce(null);
  await expect(auth()).resolves.toBeNull();
});
