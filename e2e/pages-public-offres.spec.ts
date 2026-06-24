import { test, expect } from '@playwright/test';
import { CGV_POLICY } from '@/lib/cgv-policy';
import { LEGAL } from '@/lib/legal';

test.describe('/offres — Page Tarifs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/offres');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page charge avec les formules visibles', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible();
    // At least one pricing element should be visible
    const body = await page.textContent('body');
    expect(body).toMatch(/plateforme|hybride|immersion/i);
  });

  test('prix affichés pour les formules', async ({ page }) => {
    const body = await page.textContent('body');
    expect(body).toMatch(/150/);
    expect(body).toMatch(/450/);
    expect(body).toMatch(/750/);
  });

  test('CTA redirige vers /bilan-gratuit', async ({ page }) => {
    const ctaLink = page.getByRole('link', { name: /bilan gratuit|commencer|démarrer|s'inscrire/i }).first();
    if (await ctaLink.isVisible()) {
      await ctaLink.click();
      await expect(page).toHaveURL('/bilan-gratuit');
    }
  });

  test('les 4 repères de transparence sont visibles', async ({ page }) => {
    await expect(page.getByText(/Groupes\s+de\s+5\s+maximum/).first()).toBeVisible();
    await expect(page.getByText(/Tarifs\s+en\s+TND/).first()).toBeVisible();
    await expect(page.getByText(/Acompte\s+30\s*%/).first()).toBeVisible();
    await expect(page.getByText(/[ÉE]ch[ée]anciers\s+transparents/).first()).toBeVisible();
  });

  test('paiement carte ClicToPay visible sans RIB public', async ({ page }) => {
    await expect(page.getByTestId('payment-methods-note').first()).toBeVisible();
    await expect(page.getByText(CGV_POLICY.payment.provider).first()).toBeVisible();
    await expect(page.getByText(CGV_POLICY.payment.acceptedCards).first()).toBeVisible();
    await expect(page.getByText(CGV_POLICY.payment.cardFee).first()).toBeVisible();

    const body = await page.textContent('body');
    expect(body).not.toContain(LEGAL.billing.rib);
    expect(body).not.toContain(LEGAL.billing.iban);
  });

  test('page charge sans erreur 500', async ({ page }) => {
    const response = await page.request.get('/offres');
    expect(response.status()).toBeLessThan(500);
  });
});
