import { test, expect } from '@playwright/test';

test.describe('Offres quiz flow', () => {
  test('completes quiz and shows recommendation', async ({ page }) => {
    await page.goto('/offres', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Trouvez la solution parfaite en 2 minutes/i })).toBeVisible();

    await page.getByRole('button', { name: /Scolarisé en lycée français/i }).click();
    await expect(page.getByText(/Son objectif principal est/i)).toBeVisible();

    await page.getByRole('button', { name: /Réussir le Bac/i }).click();
    await expect(page.getByText(/Son principal défi est/i)).toBeVisible();

    await page.getByRole('button', { name: /Méthodologie/i }).click();

    await expect(page.getByText(/Notre recommandation/i)).toBeVisible({ timeout: 3000 });
    await expect(page.locator('a[href="/bilan-gratuit?programme=recommande"]')).toBeVisible();
  });
});
