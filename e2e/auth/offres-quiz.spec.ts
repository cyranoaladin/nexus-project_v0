import { test, expect } from '@playwright/test';

test.describe('Offres quiz flow', () => {
  test('loads offres page with pricing and recommendation section', async ({ page }) => {
    await page.goto('/offres', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /offres\s*&\s*tarifs/i }).first()).toBeVisible();

    // Category filter buttons are visible
    await expect(page.getByRole('button', { name: /Tout voir/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Candidat libre/i }).first()).toBeVisible();

    // CTA links work
    await expect(page.getByRole('link', { name: /réserver ma place|trouver ma formule/i }).first()).toBeVisible();
  });
});
