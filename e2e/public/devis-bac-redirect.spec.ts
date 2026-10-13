/**
 * E2E — /devis-bac retiré du public (grille candidats libres 2026-2027).
 * L'ancien constructeur de devis redirige (307) vers la page de la session 2027.
 * Le moteur de devis (lib/quotes/*, DevisWizard) reste couvert par ses tests unitaires.
 */
import { test, expect } from '@playwright/test';

test('/devis-bac redirige vers /bac-candidat-libre', async ({ page }) => {
  const reponse = await page.goto('/devis-bac', { waitUntil: 'domcontentloaded' });
  expect(reponse?.status()).toBe(200);
  await expect(page).toHaveURL(/\/bac-candidat-libre$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('bac français en candidat libre');
});
