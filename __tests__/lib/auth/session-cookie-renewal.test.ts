/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isSessionTokenRenewal, withoutSessionCookieRenewal } from '@/lib/auth/session-cookie-renewal';

const renewal = 'authjs.session-token=eyJhbGciOi.synthetic; Path=/; Expires=Wed, 05 Nov 2026 10:00:00 GMT; HttpOnly; SameSite=Lax';
const secureRenewal = `__Secure-${renewal}; Secure`;
const chunkRenewal = 'authjs.session-token.0=eyJhbGciOi.part; Path=/; HttpOnly';
const deletion = 'authjs.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0';
const maxAgeZero = 'authjs.session-token=stale; Path=/; Max-Age=0';
const csrf = 'authjs.csrf-token=synthetic%7Chash; Path=/; HttpOnly';

describe('isSessionTokenRenewal', () => {
  it.each([renewal, secureRenewal, chunkRenewal])('flags a session token written with a value: %s', value => {
    expect(isSessionTokenRenewal(value)).toBe(true);
  });
  it.each([deletion, maxAgeZero, csrf, 'authjs.session-tokenx=v; Path=/'])('lets deletions and other cookies through: %s', value => {
    expect(isSessionTokenRenewal(value)).toBe(false);
  });
});

describe('withoutSessionCookieRenewal', () => {
  const respond = (cookies: string[]) => async () => {
    const headers = new Headers({ 'content-type': 'application/json' });
    for (const value of cookies) headers.append('set-cookie', value);
    return new Response('{"user":{"id":"synthetic"}}', { status: 200, headers });
  };
  const at = (path: string) => new Request(`https://nexus.example.test${path}`);

  it('withholds the renewal and keeps body, status and other cookies', async () => {
    const result = await withoutSessionCookieRenewal(respond([renewal, csrf]))(at('/api/auth/session'));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ user: { id: 'synthetic' } });
    expect(result.headers.getSetCookie()).toEqual([csrf]);
    expect(result.headers.get('content-type')).toBe('application/json');
  });

  it('keeps the deletion that retires a revoked session', async () => {
    const result = await withoutSessionCookieRenewal(respond([deletion]))(at('/api/auth/session'));
    expect(result.headers.getSetCookie()).toEqual([deletion]);
  });

  it('returns the response untouched when no session token is written', async () => {
    const original = await respond([csrf])();
    const result = await withoutSessionCookieRenewal(async () => original)(at('/api/auth/csrf'));
    expect(result).toBe(original);
  });
});

// The GET handler withholds every session-token write. That is only correct
// while every sign-in is a POST, i.e. while the providers are credentials only.
it('auth.ts configures credentials providers only', () => {
  const source = readFileSync(path.join(process.cwd(), 'auth.ts'), 'utf8');
  const providers = [...source.matchAll(/from ['"](?:next-auth|@auth\/core)\/providers\/([\w-]+)['"]/g)].map(match => match[1]);
  expect(providers).toEqual(['credentials']);
});
