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

test('static planning preserves its exact editor through unavailable canonical verification', async ({ page }) => {
  await loginAsUser(page, 'admin');
  await page.goto('/planning', { waitUntil: 'networkidle' });
  await page.locator('.card').first().click();
  const draft = page.locator('#sess-title');
  await draft.fill('Synthetic planning draft retained');
  await draft.evaluate(element => element.setAttribute('data-retained-draft', 'original-node'));
  const original = page.url();
  const mutations: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/planning-studio') && !['GET', 'HEAD'].includes(request.method())) mutations.push(request.method());
  });
  let unavailable = true;
  await page.route('**/api/auth/session', route => unavailable ? route.abort('failed') : route.continue());
  try {
    await requestProviderRefresh(page);
    await expect(page.getByText('La vérification de session est indisponible. Votre travail est conservé ; les actions sont suspendues.', { exact: true })).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toBe(original);
    await expect(draft).toHaveValue('Synthetic planning draft retained');
    await expect(draft).toHaveAttribute('data-retained-draft', 'original-node');
    await expect(page.locator('#btnApply')).toBeDisabled();
    expect(mutations).toEqual([]);
    unavailable = false;
    await page.getByRole('button', { name: 'Réessayer la vérification', exact: true }).click();
    await expect(page.locator('#btnApply')).toBeEnabled();
    await expect(draft).toHaveValue('Synthetic planning draft retained');
    await expect(draft).toHaveAttribute('data-retained-draft', 'original-node');
    expect(mutations).toEqual([]);
  } finally { await page.unrouteAll({ behavior: 'ignoreErrors' }); }
});

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
  let observedRecovery = false;
  let protectedContentRemoved = false;
  page.on('console', message => {
    if (message.text() === 'E2E_SESSION_RECOVERING') observedRecovery = true;
    if (message.text() === 'E2E_SESSION_CONTENT_REMOVED') protectedContentRemoved = true;
  });
  // Install the observation before navigation. Chromium suspends new protocol
  // evaluations while a document request is held, unlike WebKit. The existing
  // document's observer records recovery without removing protected content.
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-session-observation="RECOVERING"]')) console.info('E2E_SESSION_RECOVERING');
      if (!Array.from(document.querySelectorAll('h1')).some(heading => heading.textContent === 'Administration Nexus Réussite')) {
        console.info('E2E_SESSION_CONTENT_REMOVED');
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-session-observation'] });
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
    await expect.poll(() => observedRecovery).toBe(true);
    expect(protectedContentRemoved).toBe(false);
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
  await expect(page.getByRole('heading', { name: 'Administration Nexus Réussite' })).toBeVisible();
  await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'RECOVERING');
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

const protectedSurfaces = [
  ['admin', '/dashboard/admin'],
  ['assistante', '/dashboard/assistante'],
  ['parent', '/dashboard/parent'],
  ['student', '/dashboard/eleve'],
  ['coach', '/dashboard/coach'],
  ['ariaTerminaleMaths', '/dashboard/eleve/aria'],
] as const;

for (const [role, path] of protectedSurfaces) {
  test(`${role}: aborted real provider refresh recovers on the same protected route`, async ({ page }) => {
    await loginAsUser(page, role, { targetPath: path });
    const boundary = page.locator('[data-session-observation]');
    await expect(boundary).toHaveAttribute('data-session-observation', 'AUTHENTICATED');
    await page.waitForLoadState('networkidle');
    const original = page.url();
    const canonical = await page.request.get('/api/auth/session');
    expect(canonical.ok()).toBe(true);
    const identity = await canonical.json();
    expect(identity.user.id).toBeTruthy();
    let abortOne = true;
    let held = true;
    const pending: Route[] = [];
    await page.route('**/api/auth/session', async route => {
      if (abortOne) { abortOne = false; await route.abort('failed'); }
      else if (held) pending.push(route);
      else await route.continue();
    });
    const failed = page.waitForEvent('requestfailed', request => new URL(request.url()).pathname === '/api/auth/session');
    try {
      await requestProviderRefresh(page);
      await failed;
      await expect(boundary).toHaveAttribute('data-session-observation', 'RECOVERING');
      expect(page.url()).toBe(original);
      const stillValid = await page.request.get('/api/auth/session');
      expect((await stillValid.json()).user.id).toBe(identity.user.id);
      held = false;
      await Promise.all(pending.map(route => route.continue()));
      await expect(boundary).toHaveAttribute('data-session-observation', 'AUTHENTICATED');
      expect(page.url()).toBe(original);
    } finally {
      held = false;
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });
}

for (const recovery of ['explicit retry', 'late server response'] as const) {
test(`ten seconds of unavailable verification preserve the modal draft through ${recovery} without replay`, async ({ page }) => {
  await loginAsUser(page, 'assistante', { targetPath: '/dashboard/assistante/coaches' });
  await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED');
  await page.getByRole('button', { name: 'Ajouter un Coach', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const draft = dialog.getByLabel('Prénom', { exact: true });
  await draft.fill('Synthetic unsaved draft');
  await draft.evaluate(element => element.setAttribute('data-retained-draft', 'original-node'));
  const original = page.url();
  const mutations: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/assistante/coaches/manage' && request.method() !== 'GET') mutations.push(request.method());
  });
  let unavailable = true;
  let firstRefresh = true;
  const pending: Route[] = [];
  await page.route('**/api/auth/session', async route => {
    if (unavailable && (recovery === 'explicit retry' || firstRefresh)) {
      firstRefresh = false;
      await route.abort('failed');
    } else if (unavailable) pending.push(route);
    else await route.continue();
  });
  try {
    await requestProviderRefresh(page);
    await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'UNAVAILABLE', { timeout: 15_000 });
    expect(page.url()).toBe(original);
    await expect(draft).toHaveValue('Synthetic unsaved draft');
    await expect(draft).toHaveAttribute('data-retained-draft', 'original-node');
    await expect(dialog.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled();
    expect(mutations).toEqual([]);
    unavailable = false;
    if (recovery === 'explicit retry') {
      await dialog.getByRole('button', { name: 'Réessayer la vérification', exact: true }).click();
    } else {
      expect(pending.length).toBeGreaterThan(0);
      await Promise.all(pending.map(route => route.continue()));
    }
    await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED');
    await expect(draft).toHaveValue('Synthetic unsaved draft');
    await expect(draft).toHaveAttribute('data-retained-draft', 'original-node');
    await expect(dialog.getByRole('button', { name: 'Enregistrer', exact: true })).toBeEnabled();
    expect(page.url()).toBe(original);
    expect(mutations).toEqual([]);
  } finally { await page.unrouteAll({ behavior: 'ignoreErrors' }); }
});
}

test('delayed protected hydration never turns a valid server identity into signin navigation', async ({ page }) => {
  await loginAsUser(page, 'coach');
  let release!: () => void;
  const scriptsReady = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/_next/static/**/*.js', async route => { await scriptsReady; await route.continue(); });
  const signin: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname === '/auth/signin') signin.push(request.url()); });
  try {
    await page.goto('/dashboard/coach', { waitUntil: 'commit' });
    expect(page.url()).toContain('/dashboard/coach');
    expect((await (await page.request.get('/api/auth/session')).json()).user.role).toBe('COACH');
    release();
    await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED');
    expect(signin).toEqual([]);
  } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
});

test('genuine logout confirms server absence and exits without a recovery loop', async ({ page }) => {
  await loginAsUser(page, 'admin');
  await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED');
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const canonical = await page.request.get('/api/auth/session');
  expect(canonical.ok()).toBe(true);
  expect(await canonical.json()).toBeNull();
  await page.goto('/dashboard/admin');
  await expect(page).toHaveURL(/\/auth\/signin/);
});
