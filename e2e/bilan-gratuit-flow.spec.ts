import { test, expect } from '@playwright/test';

test.describe('Bilan gratuit multi-step', () => {
  test('validates step 1 and advances to step 2', async ({ page }) => {
    await page.goto('/bilan-gratuit', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Créez Votre Compte Parent et Élève/i })).toBeVisible();

    // Fill step 1
    await page.getByLabel(/Prénom \*/i).fill('Parent');
    await page.getByLabel('Nom *', { exact: true }).fill('Test');
    await page.getByLabel(/Email \*/i).fill(`e2e-bilan-${Date.now()}@test.com`);
    await page.getByLabel(/Téléphone \*/i).fill('+216 99 11 22 33');
    await page.getByLabel(/Mot de passe \*/i).fill('Test1234!');

    await page.getByRole('button', { name: /Suivant/i }).click();

    await expect(page.getByText(/Étape 2 : Informations Élève/i)).toBeVisible();
  });
});
