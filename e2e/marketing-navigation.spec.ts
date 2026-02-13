import { test, expect } from '@playwright/test';

test.describe('Marketing navigation', () => {
  test('offres page loads and shows main CTA', async ({ page }) => {
    await page.goto('/offres');
    await expect(page.getByRole('heading', { name: /investissez dans la seule garantie/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /démarrer un bilan gratuit/i }).first()).toBeVisible();
  });

  test('contact page loads and shows contact direct section', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.getByRole('heading', { name: /votre première question/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /contact direct/i })).toBeVisible();
  });

  test('academy page exposes catalogue CTA', async ({ page }) => {
    await page.goto('/academy');
    await expect(page.getByRole('heading', { name: /nexus academy/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /découvrir le catalogue/i })).toHaveAttribute(
      'href',
      '/contact?subject=Catalogue%20Academy'
    );
  });

  test('famille page shows main CTA', async ({ page }) => {
    await page.goto('/famille');
    await expect(page.getByRole('heading', { name: /mention au bac/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /démarrer un bilan gratuit/i }).first()).toBeVisible();
  });
});
