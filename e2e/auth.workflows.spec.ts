import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';
import { CREDS } from './helpers/credentials';
import { SELECTORS } from './selectors';

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
    await page.goto('/auth/signin');
    await page.locator(SELECTORS.auth.email).fill('nobody@example.com');
    await page.locator(SELECTORS.auth.password).fill('bad-password');
    await page.locator(SELECTORS.auth.submit).click();
    await expect(page.getByText(/email ou mot de passe incorrect/i)).toBeVisible();
  });

  test('deja connecte -> auth/* redirigé', async ({ page }) => {
    await loginAsUser(page, 'student');
    await page.goto('/auth/signin');
    await expect(page).toHaveURL(/\/dashboard\/eleve/);
    await page.goto('/auth/activate');
    await expect(page).toHaveURL(/\/dashboard\/eleve/);
    await page.goto('/auth/reset-password');
    await expect(page).toHaveURL(/\/dashboard\/eleve/);
  });

  test('mot de passe oublié anti-enumeration', async ({ page }) => {
    await page.goto('/auth/mot-de-passe-oublie');

    const resetResponsePromise = page.waitForResponse((res) =>
      res.url().includes('/api/auth/reset-password') && res.request().method() === 'POST'
    );

    await page.locator('input[type="email"]').fill(CREDS.parent.email);
    await page.locator('button[type="submit"]').click();

    const res = await resetResponsePromise;
    expect([200, 201]).toContain(res.status());
    await expect(page.getByText(/si un compte existe|email envoyé|vérifiez/i).first()).toBeVisible();
  });
});
