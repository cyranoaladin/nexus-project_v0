import { test, expect } from '@playwright/test';

test.describe('Marketing navigation', () => {
  test('offres page loads and shows main CTA', async ({ page }) => {
    await page.goto('/offres');
    await expect(page.getByRole('heading', { name: /offres\s*&\s*tarifs/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /réserver ma place|trouver ma formule/i }).first()).toBeVisible();
  });

  test('contact page loads and shows contact direct section', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.getByRole('heading', { name: /une question claire/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /contact direct/i })).toBeVisible();
  });

  test('famille page shows main CTA', async ({ page }) => {
    await page.goto('/famille');
    await expect(page.getByRole('heading', { name: /mention au bac/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /démarrer un bilan gratuit/i }).first()).toBeVisible();
  });
});
