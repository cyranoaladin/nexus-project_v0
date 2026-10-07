import { expect, test, type APIResponse, type Page, type Route } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

/**
 * A session refresh already in flight when the user signs out must not bring
 * the session back.
 *
 * With the JWT strategy, every authenticated `GET /api/auth/session` re-issues
 * the session cookie. When such a response lands AFTER `POST /api/auth/signout`
 * has deleted the cookie, it writes it back, the post-logout verification sees
 * a live session, and the user is left on the "vérification indisponible"
 * notice while still signed in. Under CI load this happened to
 * parent-email-onboarding.spec.ts about one run in five; here the overlap is
 * forced, so the outcome is deterministic.
 */

async function requestProviderRefresh(page: Page) {
  await page.evaluate(() => {
    const channel = new BroadcastChannel('next-auth');
    channel.postMessage({ event: 'session', data: { trigger: 'getSession' } });
    channel.close();
  });
}

const hasSessionCookie = async (page: Page) =>
  (await page.context().cookies()).some(({ name }) => name === 'authjs.session-token');

test('a session refresh in flight during logout cannot resurrect the session', async ({ page }) => {
  await loginAsUser(page, 'parent');
  await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED');

  // A session read issued before the logout click reaches the server at once,
  // with the pre-logout cookie; only its RESPONSE is delayed past the logout.
  const held: Array<Promise<{ route: Route; response: APIResponse }>> = [];
  let holding = true;
  let heldOne!: () => void;
  const firstHeld = new Promise<void>((resolve) => { heldOne = resolve; });
  await page.route('**/api/auth/session', async (route) => {
    if (holding && route.request().method() === 'GET') {
      held.push(route.fetch().then((response) => ({ route, response })));
      heldOne();
      return;
    }
    await route.continue();
  });

  await requestProviderRefresh(page);
  await firstHeld;
  // Requests issued from the click on (the logout's own reads) pass through.
  holding = false;

  const signout = page.waitForResponse((response) =>
    response.url().includes('/api/auth/signout') && response.request().method() === 'POST');
  // Sidebar button on desktop, header button on mobile: both use useCanonicalSignOut.
  await page.getByRole('button', { name: /^(Se déconnecter de votre compte|Déconnexion)$/ })
    .filter({ visible: true }).first().click();
  expect((await signout).status()).toBe(200);
  await expect.poll(() => hasSessionCookie(page)).toBe(false);

  // The stale refresh response, renewing the pre-logout cookie, lands now.
  for (const { route, response } of await Promise.all(held.splice(0))) await route.fulfill({ response }).catch(() => undefined);

  await page.waitForURL((url) => ['/auth/signin', '/'].includes(url.pathname), { waitUntil: 'commit' });
  await expect.poll(() => hasSessionCookie(page)).toBe(false);
  await page.unrouteAll({ behavior: 'wait' });

  const canonical = await page.request.get('/api/auth/session');
  expect(canonical.ok()).toBe(true);
  expect(await canonical.json()).toBeNull();

  // Back button: the previous history entry is the private dashboard.
  await page.goBack();
  await expect(page.getByRole('link', { name: 'Mes enfants' })).toHaveCount(0);
  expect(await hasSessionCookie(page)).toBe(false);

  // Direct re-entry is refused.
  await page.goto('/dashboard/parent');
  await expect(page).toHaveURL(/\/auth\/signin/);
});
