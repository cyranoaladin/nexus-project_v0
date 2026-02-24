import { test, expect } from '@playwright/test';

test.describe('Bilan Gratuit — Formulaire multi-étapes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bilan-gratuit');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page charge avec étape 1 visible', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByTestId('input-parent-firstname')).toBeVisible();
    await expect(page.getByTestId('input-parent-email')).toBeVisible();
  });

  test('validation empêche la soumission avec champs vides', async ({ page }) => {
    await page.getByTestId('btn-next-step').click();
    // Error messages should appear
    await expect(page.getByTestId('error-parent-firstname')).toBeVisible();
    await expect(page.getByTestId('error-parent-email')).toBeVisible();
  });

  test('validation email invalide affiche erreur', async ({ page }) => {
    await page.getByTestId('input-parent-firstname').fill('Marie');
    await page.getByTestId('input-parent-lastname').fill('Dupont');
    await page.getByTestId('input-parent-email').fill('pas-un-email');
    await page.getByTestId('input-parent-tel').fill('+216 99 19 28 29');
    await page.getByTestId('input-parent-password').fill('TestPass123!');
    await page.getByTestId('btn-next-step').click();
    await expect(page.getByTestId('error-parent-email')).toBeVisible();
  });

  test('étape 1 → étape 2 fonctionne avec données valides', async ({ page }) => {
    await page.getByTestId('input-parent-firstname').fill('Marie');
    await page.getByTestId('input-parent-lastname').fill('Dupont');
    await page.getByTestId('input-parent-email').fill(`test.e2e.${Date.now()}@nexus-test.com`);
    await page.getByTestId('input-parent-tel').fill('+216 99 19 28 29');
    await page.getByTestId('input-parent-password').fill('TestPass123!');
    await page.getByTestId('btn-next-step').click();
    // Step 2 should be visible
    await expect(page.getByTestId('input-child-firstname')).toBeVisible({ timeout: 5000 });
  });

  test('étape 2 affiche les champs élève', async ({ page }) => {
    // Fill step 1
    await page.getByTestId('input-parent-firstname').fill('Marie');
    await page.getByTestId('input-parent-lastname').fill('Dupont');
    await page.getByTestId('input-parent-email').fill(`test.e2e.${Date.now()}@nexus-test.com`);
    await page.getByTestId('input-parent-tel').fill('+216 99 19 28 29');
    await page.getByTestId('input-parent-password').fill('TestPass123!');
    await page.getByTestId('btn-next-step').click();
    // Verify step 2 fields
    await expect(page.getByTestId('input-child-firstname')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('select-child-level')).toBeVisible();
    await expect(page.getByTestId('select-current-level')).toBeVisible();
  });

  test('page confirmation existe et contient les bons éléments', async ({ page }) => {
    await page.goto('/bilan-gratuit/confirmation');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/félicitations|confirmé|créé|enregistré/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /accueil|retour|connexion/i }).first()).toBeVisible();
  });

  test('bouton retour sur confirmation fonctionne', async ({ page }) => {
    await page.goto('/bilan-gratuit/confirmation');
    await page.waitForLoadState('domcontentloaded');
    const retourLink = page.getByRole('link', { name: /retour.*accueil/i });
    if (await retourLink.isVisible()) {
      await retourLink.click();
      await expect(page).toHaveURL('/');
    }
  });
});
