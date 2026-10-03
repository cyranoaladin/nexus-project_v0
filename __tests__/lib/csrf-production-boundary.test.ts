import { NextRequest } from 'next/server';
import { checkCsrf } from '@/lib/csrf';

const originalEnv = { ...process.env };
beforeEach(() => {
  process.env = { ...process.env, NODE_ENV: 'production' };
  delete process.env.NEXTAUTH_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
});
afterEach(() => { process.env = { ...originalEnv }; });

function post(headers: Record<string, string>) {
  return new NextRequest('https://nexusreussite.academy/api/test', { method: 'POST', headers });
}

const rejectedHeaders: Record<string, string>[] = [
  { origin: 'https://hostile.example', host: 'hostile.example' },
  { origin: 'https://hostile.example', 'x-forwarded-host': 'hostile.example' },
  { origin: 'http://nexusreussite.academy', host: 'nexusreussite.academy' },
  { origin: 'http://localhost:4567' },
  { origin: 'http://127.0.0.1:4567' },
  { origin: 'https://hostile.example', referer: 'https://nexusreussite.academy/dashboard' },
  { origin: 'null' },
  { origin: 'https://user:password@nexusreussite.academy' },
  { origin: 'https://nexusreussite.academy/unexpected-path' },
  { origin: 'https://nexusreussite.academy, https://hostile.example' },
  { referer: 'https://hostile.example/dashboard' },
  {},
];
test.each(rejectedHeaders)('production rejects untrusted or malformed source %#', headers => {
  expect(checkCsrf(post(headers))?.status).toBe(403);
});

test('allows the canonical HTTPS origin', () => {
  expect(checkCsrf(post({ origin: 'https://nexusreussite.academy' }))).toBeNull();
});
test('allows a trusted Referer only when Origin is absent', () => {
  expect(checkCsrf(post({ referer: 'https://nexusreussite.academy/dashboard?tab=security' }))).toBeNull();
});
test('an explicitly configured local origin is scoped to its port', () => {
  process.env.NEXTAUTH_URL = 'http://localhost:59499/api/auth';
  expect(checkCsrf(post({ origin: 'http://localhost:59499' }))).toBeNull();
  expect(checkCsrf(post({ origin: 'http://localhost:59500' }))?.status).toBe(403);
});
test('an explicitly configured preview is scoped to its HTTPS origin', () => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://preview.example/';
  expect(checkCsrf(post({ origin: 'https://preview.example' }))).toBeNull();
  expect(checkCsrf(post({ origin: 'http://preview.example' }))?.status).toBe(403);
});
