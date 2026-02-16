import { test, expect } from '@playwright/test';

test.describe('Offres quiz flow', () => {
  test('loads offres page with pricing and recommendation section', async ({ page }) => {
    await page.goto('/offres', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Investissez dans la seule garantie/i })).toBeVisible();

    // Quick recommendation section exists
    await expect(page.getByRole('heading', { name: /Recommandation rapide/i })).toBeVisible();

    // Profile buttons are visible
    await expect(page.getByRole('button', { name: /Lycée français/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Candidat libre/i })).toBeVisible();

    // CTA links work
    await expect(page.getByRole('link', { name: /Démarrer un bilan gratuit/i }).first()).toBeVisible();
  });
});
