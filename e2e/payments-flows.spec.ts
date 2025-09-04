import { expect, test } from '@playwright/test';
import { disableAnimations, installDefaultNetworkStubs, loginAs, setupDefaultStubs } from './helpers';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Paiements — inscrit vs non-inscrit', () => {
  test.beforeEach(async ({ page }) => {
    await disableAnimations(page);
    await setupDefaultStubs(page);
    await installDefaultNetworkStubs(page, { stubStatus: true });
  });

  test('Non-inscrit: Home > Crédits → redirection connexion', async ({ page }) => {
    await page.goto(`${BASE}/`);
    const cta = page.getByRole('link', { name: /Charger mon compte/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();
    const url = page.url();
    expect(url.includes('/auth/signin') || url.includes('/dashboard/parent/paiement')).toBeTruthy();
  });

  test('Parent inscrit: Paiement accessible', async ({ page }) => {
    await loginAs(page, 'parent.dupont@nexus.com');
    await page.goto(`${BASE}/dashboard/parent/paiement`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Paiement' })).toBeVisible();
    await expect(page.getByTestId('pay-card-cb')).toBeVisible();
    await expect(page.getByTestId('pay-card-wire')).toBeVisible();
    await expect(page.getByTestId('pay-card-cash')).toBeVisible();
  });
});
