import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';
import { SELECTORS } from '../selectors';
import { resetDisposableE2ERateLimits } from '../helpers/rate-limit';

const ROLE_TESTS = [
  { key: 'admin', expected: '/dashboard/admin' },
  { key: 'coach', expected: '/dashboard/coach' },
  { key: 'parent', expected: '/dashboard/parent' },
  { key: 'student', expected: '/dashboard/eleve' },
] as const;

test.describe('Auth workflows', () => {
  test.describe.configure({ mode: 'serial' });
  for (const roleCase of ROLE_TESTS) {
    test(`login OK ${roleCase.key}`, async ({ page }) => {
      await loginAsUser(page, roleCase.key);
      await expect(page).toHaveURL(new RegExp(roleCase.expected));
    });
  }

  test('login KO', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
    await page.locator(SELECTORS.auth.email).fill('nobody@example.com');
    await page.locator(SELECTORS.auth.password).fill('bad-password');
    await page.locator(SELECTORS.auth.submit).click();
    await expect(page.getByText(/identifiant ou mot de passe incorrect/i)).toBeVisible();
  });

  test('a credentials transport failure shows an actionable error without authenticating', async ({ page }) => {
    await resetDisposableE2ERateLimits();
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
    // Auth.js appends an empty query marker; match the pathname, not a glob
    // that would accidentally let the real credentials request authenticate.
    await page.route(url => url.pathname === '/api/auth/callback/credentials', route => route.abort('failed'));
    try {
      await page.locator(SELECTORS.auth.email).fill(CREDS.parent.email);
      await page.locator(SELECTORS.auth.password).fill(CREDS.parent.password);
      await Promise.all([
        page.waitForEvent('requestfailed', {
          predicate: request => new URL(request.url()).pathname === '/api/auth/callback/credentials',
          timeout: 10_000,
        }),
        page.locator(SELECTORS.auth.submit).click(),
      ]);
      await expect(page.getByRole('alert').filter({ hasText: 'Une erreur est survenue lors de la connexion' })).toBeVisible();
      await expect(page.locator(SELECTORS.auth.submit)).toBeEnabled();
      await expect(page).toHaveURL(/\/auth\/signin$/);
      const response = await page.request.get('/api/auth/session');
      expect(response.status()).toBe(200);
      expect((await response.json())?.user).toBeUndefined();
    } finally { if (!page.isClosed()) await page.unrouteAll({ behavior: 'wait' }); }
  });

  test('les surfaces auth gardent leur contrat quand une session existe', async ({ page }) => {
    await loginAsUser(page, 'student');
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard\/eleve/);
    await page.goto('/auth/activate', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/activate/);
    await expect(page.getByRole('heading', { name: /lien invalide/i })).toBeVisible();
    await page.goto('/auth/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/reset-password/);
    await expect(page.getByRole('heading', { name: /lien invalide/i })).toBeVisible();
  });

  test('mot de passe oublié anti-enumeration', async ({ page }) => {
    await page.goto('/auth/mot-de-passe-oublie', { waitUntil: 'domcontentloaded' });

    const resetResponsePromise = page.waitForResponse((res) =>
      res.url().includes('/api/auth/reset-password') && res.request().method() === 'POST'
    );

    await page.locator('#email').fill(CREDS.parent.email);
    await page.locator('main button[type="submit"]').click();

    const res = await resetResponsePromise;
    expect([200, 201]).toContain(res.status());
    // app/auth/mot-de-passe-oublie/page.tsx renders its own generic
    // confirmation copy (unified for both the email and WhatsApp recovery
    // channels) rather than the API's `message` field -- assert on that
    // stable heading instead of the API's wording.
    await expect(page.getByRole('heading', { name: /demande prise en compte/i })).toBeVisible();
  });
});
