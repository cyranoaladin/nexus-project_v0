#!/usr/bin/env node

// Run from the checkout against the copied production standalone. The fixture
// lives only in the CI PostgreSQL service; no runtime dependency is copied into
// the standalone directory.
import { randomBytes, randomUUID } from 'node:crypto';

const origin = process.argv[2];
if (origin !== 'http://localhost:3211') throw new Error('VIDEO_BROWSER_ORIGIN_INVALID');

// Fail before loading Prisma or writing a fixture. Both the explicit marker
// and the exact local database name are required, even on a developer machine.
let databaseUrl;
try {
  databaseUrl = new URL(process.env.DATABASE_URL ?? '');
} catch {
  // The error must never contain a raw connection URL or credentials.
}
if (
  process.env.NEXUS_DISPOSABLE_POSTGRES !== '1'
  || databaseUrl?.protocol !== 'postgresql:'
  || !['localhost', '127.0.0.1'].includes(databaseUrl.hostname)
  || databaseUrl.port !== '5432'
  || databaseUrl.pathname !== '/nexus_disposable_video_test'
  || databaseUrl.search
  || databaseUrl.hash
) {
  console.error('VIDEO_BROWSER_DATABASE_NOT_DISPOSABLE');
  process.exit(1);
}

const [{ PrismaClient }, { default: bcrypt }, { chromium }] = await Promise.all([
  import('@prisma/client'),
  import('bcryptjs'),
  import('playwright'),
]);

const prisma = new PrismaClient();
let browser;
let fixtureId;

function fail(code) {
  throw new Error(code);
}

try {
  // A real, activated parent identity exercises the production Credentials
  // provider and session verification. Neither its identity nor password is
  // printed; the account is removed after the browser check.
  const email = `video-disabled-${randomUUID()}@example.test`;
  const password = randomBytes(48).toString('base64url');
  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 12),
      role: 'PARENT',
      firstName: 'CI',
      lastName: 'Video',
      activatedAt: new Date(),
      emailVerifiedAt: new Date(),
      registrationCompletedAt: new Date(),
      parentProfile: { create: {} },
    },
    select: { id: true },
  });
  fixtureId = user.id;

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  try {
    const csrfResponse = await context.request.get(`${origin}/api/auth/csrf`);
    if (csrfResponse.status() !== 200) fail(`VIDEO_BROWSER_CSRF_HTTP_${csrfResponse.status()}`);
    const { csrfToken } = await csrfResponse.json();
    if (typeof csrfToken !== 'string' || !csrfToken) fail('VIDEO_BROWSER_CSRF_MISSING');

    const loginResponse = await context.request.post(`${origin}/api/auth/callback/credentials`, {
      form: { csrfToken, email, password, callbackUrl: `${origin}/session/video`, json: 'true' },
      maxRedirects: 0,
    });
    if (![200, 302].includes(loginResponse.status())) fail(`VIDEO_BROWSER_LOGIN_HTTP_${loginResponse.status()}`);
    const sessionResponse = await context.request.get(`${origin}/api/auth/session`);
    if (sessionResponse.status() !== 200) fail(`VIDEO_BROWSER_SESSION_HTTP_${sessionResponse.status()}`);
    const session = await sessionResponse.json();
    if (session?.user?.email !== email) fail('VIDEO_BROWSER_SESSION_NOT_AUTHENTICATED');

    const page = await context.newPage();
    let jitsiRequests = 0;
    let joinPosts = 0;
    let pageErrors = 0;
    let consoleErrors = 0;
    let serverErrors = 0;
    page.on('request', (request) => {
      const url = new URL(request.url());
      const hostname = url.hostname.toLowerCase();
      if (/external_api\.js$/i.test(url.pathname)
        || hostname === 'meet.jit.si'
        || hostname.includes('jitsi')) jitsiRequests += 1;
      if (request.method() === 'POST' && /^\/api\/sessions\/[^/]+\/?$/.test(url.pathname)) joinPosts += 1;
    });
    page.on('websocket', () => { jitsiRequests += 1; });
    page.on('pageerror', () => { pageErrors += 1; });
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors += 1;
    });
    page.on('response', (response) => {
      if (response.status() >= 500) serverErrors += 1;
    });

    // The query value is deliberately not a booking. The disabled client page
    // must show availability without attempting the POST join action.
    const response = await page.goto(`${origin}/session/video?sessionId=ci-disabled-${randomUUID()}`, {
      waitUntil: 'load',
    });
    if (response?.status() !== 200) fail(`VIDEO_BROWSER_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
    await page.getByRole('heading', { name: 'Visioconférence indisponible' })
      .waitFor({ state: 'visible' }).catch(() => fail('VIDEO_BROWSER_DISABLED_UI_NOT_VISIBLE'));
    await page.getByText('Visioconférence intégrée non activée sur cette Preview.', { exact: true })
      .waitFor({ state: 'visible' }).catch(() => fail('VIDEO_BROWSER_DISABLED_UI_NOT_VISIBLE'));
    if (new URL(page.url()).pathname !== '/session/video') fail('VIDEO_BROWSER_REDIRECTED');
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    if (joinPosts) fail(`VIDEO_BROWSER_JOIN_POSTS_${joinPosts}`);
    if (jitsiRequests) fail(`VIDEO_BROWSER_JITSI_REQUESTS_${jitsiRequests}`);
    if (pageErrors) fail(`VIDEO_BROWSER_PAGE_ERRORS_${pageErrors}`);
    if (consoleErrors) fail(`VIDEO_BROWSER_CONSOLE_ERRORS_${consoleErrors}`);
    if (serverErrors) fail(`VIDEO_BROWSER_SERVER_ERRORS_${serverErrors}`);
    console.log('VIDEO_AUTHENTICATED_DISABLED_UI=PASS');
    console.log('VIDEO_BROWSER_JOIN_POSTS=0');
    console.log('VIDEO_BROWSER_JITSI_REQUESTS=0');
    console.log('VIDEO_BROWSER_PAGE_ERRORS=0');
    console.log('VIDEO_BROWSER_CONSOLE_ERRORS=0');
    console.log('VIDEO_BROWSER_SERVER_ERRORS=0');
  } finally {
    await context.close();
  }
} catch (error) {
  const code = error instanceof Error && /^VIDEO_BROWSER_[A-Z0-9_]+$/.test(error.message)
    ? error.message : 'VIDEO_BROWSER_UNEXPECTED';
  console.error(code);
  process.exitCode = 1;
} finally {
  try {
    if (browser) await browser.close();
  } finally {
    if (fixtureId) await prisma.user.delete({ where: { id: fixtureId } }).catch(() => {
      console.error('VIDEO_BROWSER_FIXTURE_CLEANUP_FAILED');
      process.exitCode = 1;
    });
    await prisma.$disconnect();
  }
}
