/** @jest-environment node */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { request, type APIRequestContext } from 'playwright-core';
import type { Page } from '@playwright/test';
import { waitForAuthenticatedSession } from '@/e2e/helpers/auth';

jest.mock('@/e2e/helpers/credentials', () => ({ CREDS: {} }));
jest.mock('@/e2e/helpers/rate-limit', () => ({ resetDisposableE2ERateLimits: jest.fn() }));

const expectedEmail = 'expected-session@example.test';
let server: Server;
let context: APIRequestContext;
let origin: string;
let replies: Array<'reset' | 'absent' | 'different' | 'expected'>;
let received: Array<{ method?: string; path?: string }>;

beforeEach(async () => {
  replies = [];
  received = [];
  server = createServer((req, res) => {
    received.push({ method: req.method, path: req.url });
    const reply = replies.shift();
    if (reply === 'reset') { req.socket.resetAndDestroy(); return; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(reply === 'expected' ? { user: { email: expectedEmail } }
      : reply === 'different' ? { user: { email: 'other-session@example.test' } } : null));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  context = await request.newContext();
});

afterEach(async () => {
  await context.dispose();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

function pageWithRealTransport() {
  // The application origin is redirected to the local fixture; the helper's
  // GET options, Node socket and installed Playwright transport stay real.
  return { request: { get: jest.fn((url: string, options: Parameters<APIRequestContext['get']>[1]) =>
    context.get(`${origin}${new URL(url).pathname}`, options)) } } as unknown as Page;
}

it('continues bounded observation after a real socket reset and accepts only the expected identity', async () => {
  replies = ['reset', 'different', 'expected'];
  await expect(waitForAuthenticatedSession(pageWithRealTransport(), expectedEmail, 3)).resolves.toBeUndefined();
  expect(received).toEqual(Array.from({ length: 3 }, () => ({ method: 'GET', path: '/api/auth/session' })));
});

it('fails at the existing observation bound when every real session socket resets', async () => {
  replies = ['reset', 'reset', 'reset'];
  await expect(waitForAuthenticatedSession(pageWithRealTransport(), expectedEmail, 3))
    .rejects.toThrow('Unable to establish authenticated session');
  expect(received).toHaveLength(3);
  expect(received.every(item => item.method === 'GET' && item.path === '/api/auth/session')).toBe(true);
});

it.each(['different', 'absent'] as const)('never accepts a persistently %s identity', async reply => {
  replies = [reply, reply];
  await expect(waitForAuthenticatedSession(pageWithRealTransport(), expectedEmail, 2))
    .rejects.toThrow('Unable to establish authenticated session');
  expect(received).toHaveLength(2);
});

it('does not turn programming or disposed-context failures into repeated observations', async () => {
  const get = jest.fn(async () => { throw new TypeError('Invalid request context'); });
  await expect(waitForAuthenticatedSession({ request: { get } } as unknown as Page, expectedEmail, 3))
    .rejects.toThrow('Invalid request context');
  expect(get).toHaveBeenCalledTimes(1);
  expect(received).toEqual([]);
});
