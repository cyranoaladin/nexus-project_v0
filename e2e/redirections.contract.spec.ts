import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

const LEGACY_REDIRECTS = [
  { from: '/inscription', to: '/bilan-gratuit', status: 307 },
  { from: '/questionnaire', to: '/bilan-gratuit', status: 307 },
  { from: '/tarifs', to: '/offres', status: 307 },
  { from: '/academies-hiver', to: '/stages', status: 301 },
  { from: '/plateforme', to: '/plateforme-aria', status: 301 },
  { from: '/education', to: '/accompagnement-scolaire', status: 301 },
];

test.describe('Redirections contractuelles', () => {
  test.describe.configure({ mode: 'serial' });
  for (const redirectCase of LEGACY_REDIRECTS) {
    test(`${redirectCase.from} -> ${redirectCase.to}`, async ({ page, baseURL }) => {
      const initial = await page.request.fetch(`${baseURL}${redirectCase.from}`, {
        maxRedirects: 0,
        failOnStatusCode: false,
      });
      expect([301, 302, 307, 308]).toContain(initial.status());
      const location = initial.headers()['location'] || '';
      expect(location).toContain(redirectCase.to);

      await page.goto(redirectCase.from);
      await expect(page).toHaveURL(new RegExp(`${redirectCase.to.replace('/', '\\/')}`));
    });
  }

  test('/stages redirige vers /stages/fevrier-2026', async ({ page }) => {
    await page.goto('/stages');
    await expect(page).toHaveURL(/\/stages\/fevrier-2026/);
  });

  test('/dashboard/* anonyme redirige vers signin', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test('/auth/* connecté redirige vers dashboard role', async ({ page }) => {
    await loginAsUser(page, 'parent');
    await page.goto('/auth/signin');
    await expect(page).toHaveURL(/\/dashboard\/parent/);

    await page.goto('/auth/reset-password');
    await expect(page).toHaveURL(/\/dashboard\/parent/);
  });
});
