import { expect, test, type Page, type Route } from '@playwright/test';
import { loginAsUser, resetBrowserSession } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';
import { resetDisposableE2ERateLimits } from '../helpers/rate-limit';

async function requestProviderRefresh(page: Page) {
  await page.evaluate(() => {
    const channel = new BroadcastChannel('next-auth');
    channel.postMessage({ event: 'session', data: { trigger: 'getSession' } });
    channel.close();
  });
}

test('sign-in remains non-interactive until delayed JavaScript hydrates the controlled inputs', async ({ page }) => {
  await resetDisposableE2ERateLimits();
  await resetBrowserSession(page);
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve; });
  await page.route('**/_next/static/**/*.js', async route => {
    await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto('/auth/signin', { waitUntil: 'commit' });
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#email')).toBeDisabled();
    await expect(page.locator('#password')).toBeDisabled();
    await expect(page.getByTestId('btn-signin')).toBeDisabled();
    releaseScripts();
    await expect(page.locator('#email')).toBeEnabled();
    await page.locator('#email').fill(CREDS.admin.email);
    await page.locator('#password').fill(CREDS.admin.password);
    await expect(page.locator('#email')).toHaveValue(CREDS.admin.email);
    await page.getByTestId('btn-signin').click();
    await expect(page).toHaveURL(/\/dashboard\/admin$/);
    await expect(page.getByRole('heading', { name: 'Administration Nexus Réussite' })).toBeVisible();
  } finally {
    releaseScripts();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('an aborted session refresh cannot replace an in-flight planning navigation', async ({ page }) => {
  await loginAsUser(page, 'admin');
  await expect(page.getByRole('heading', { name: 'Administration Nexus Réussite' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  let releaseNavigation!: () => void;
  let navigationStarted!: () => void;
  const navigationHeld = new Promise<void>(resolve => { navigationStarted = resolve; });
  const navigationReleased = new Promise<void>(resolve => { releaseNavigation = resolve; });
  await page.route('**/planning', async route => {
    if (route.request().resourceType() === 'document') {
      navigationStarted();
      await navigationReleased;
    }
    await route.continue();
  });
  let abortNextRefresh = true;
  let heldRefresh!: Route;
  let refreshStarted!: () => void;
  const refreshHeld = new Promise<void>(resolve => { refreshStarted = resolve; });
  await page.route('**/api/auth/session', async route => {
    if (abortNextRefresh) {
      abortNextRefresh = false;
      heldRefresh = route;
      refreshStarted();
    } else await route.continue();
  });
  const unintendedNavigations: string[] = [];
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/auth/signin' || pathname === '/dashboard') unintendedNavigations.push(pathname);
  });
  let observedNullSession = false;
  page.on('console', message => {
    if (message.text() === 'E2E_SESSION_CONTENT_REMOVED') observedNullSession = true;
  });
  // Install the observation before navigation. Chromium suspends new protocol
  // evaluations while a document request is held, unlike WebKit. The existing
  // document's observer still records the actual null-session render.
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (!Array.from(document.querySelectorAll('h1')).some(heading => heading.textContent === 'Administration Nexus Réussite')) {
        console.info('E2E_SESSION_CONTENT_REMOVED');
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  // Hold a real refresh BEFORE navigation: WebKit may refuse new fetches
  // once document navigation starts, so waiting for a new confirmation then
  // would deadlock the test rather than exercise an in-flight refresh.
  await requestProviderRefresh(page);
  await refreshHeld;
  const navigation = page.goto('/planning', { waitUntil: 'domcontentloaded' });
  // Attach a rejection handler immediately; preserve and assert the actual result below.
  const outcome = navigation.then(() => null, (error: Error) => error);
  try {
    await navigationHeld;
    await heldRefresh.abort('failed');
    await expect.poll(() => observedNullSession).toBe(true);
    releaseNavigation();
    expect(await outcome).toBeNull();
    await expect(page.locator('#gridWrap')).toBeVisible();
    expect(unintendedNavigations).toEqual([]);
  } finally {
    releaseNavigation();
    await page.unrouteAll({ behavior: 'wait' });
    await outcome;
  }
});

test('the real session provider still observes revocation on focus after recovering from a network failure', async ({ page }) => {
  await loginAsUser(page, 'admin');
  await expect(page.getByRole('heading', { name: 'Administration Nexus Réussite' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  let abortNextRefresh = true;
  let holdRecovery = true;
  const pendingRecovery: Route[] = [];
  await page.route('**/api/auth/session', async route => {
    if (abortNextRefresh) {
      abortNextRefresh = false;
      await route.abort('failed');
    } else if (holdRecovery) pendingRecovery.push(route);
    else await route.continue();
  });
  const failed = page.waitForEvent('requestfailed', request => new URL(request.url()).pathname === '/api/auth/session');
  const recovery = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/session' && response.status() === 200);
  // The storage branch does not rebroadcast its failed response. A focus
  // refresh would schedule another provider fetch that could mask a broken
  // hook recovery by independently restoring the canonical cache.
  await requestProviderRefresh(page);
  await failed;
  await expect(page.getByRole('heading', { name: 'Administration Nexus Réussite' })).not.toBeVisible();
  holdRecovery = false;
  await Promise.all(pendingRecovery.map(route => route.continue()));
  await recovery;
  await expect(page.getByRole('heading', { name: 'Administration Nexus Réussite' })).toBeVisible();
  // Real server revocation, not a mocked auth response or a deleted browser cookie.
  const revoked = await page.evaluate(async () => (await fetch('/api/auth/sessions/revoke', { method: 'POST' })).status);
  expect(revoked).toBe(200);
  const refresh = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/session');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await refresh;
  await expect(page).toHaveURL(/\/auth\/signin/);
  await expect(page.getByRole('heading', { name: 'Administration Nexus Réussite' })).not.toBeVisible();
});
