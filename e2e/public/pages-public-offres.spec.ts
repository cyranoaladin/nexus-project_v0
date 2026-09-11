import { test, expect } from '@playwright/test';
import { CGV_POLICY } from '@/lib/cgv-policy';
import { LEGAL } from '@/lib/legal';
import { PRICING_RULES } from '@/lib/pricing-client';

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
    // Prices are rendered dynamically from data/pricing.canonical.json's
    // price_annual field (app/offres/page.tsx:324), so asserting specific
    // hardcoded amounts goes stale on every catalogue change -- this test
    // previously hardcoded 150/450/750 TND, values from a removed 3-tier
    // ACCES_PLATEFORME/HYBRIDE/IMMERSION subscription model that no longer
    // exists on this page (found via E2E orphan-spec triage). Assert the
    // real, stable invariant instead: the page actually displays several
    // distinct TND price amounts, matching how prices are truly rendered.
    const body = await page.textContent('body');
    const priceMatches = body?.match(/\d[\d\s ]{0,6}TND/g) ?? [];
    expect(priceMatches.length).toBeGreaterThanOrEqual(3);
  });

  test('CTA redirige vers /bilan-gratuit', async ({ page }) => {
    const ctaLink = page.getByRole('link', { name: /bilan gratuit|commencer|démarrer|s'inscrire/i }).first();
    if (await ctaLink.isVisible()) {
      await ctaLink.click();
      await expect(page).toHaveURL('/bilan-gratuit');
    }
  });

  test('les 4 repères de transparence sont visibles', async ({ page }) => {
    await expect(
      page.getByText(new RegExp(`${PRICING_RULES.group_max}\\s+élèves\\s+max`, 'i')).first(),
    ).toBeVisible();
    await expect(page.getByText(/Tarifs\s+en\s+TND/).first()).toBeVisible();
    await expect(page.getByText(/Forfait\s+annuel\s+payable\s+en\s+9\s+mensualit[ée]s/i).first()).toBeVisible();
    await expect(page.getByText(/[ÉE]ch[ée]anciers\s+transparents/).first()).toBeVisible();
  });

  test('paiement fail-closed visible sans ClicToPay ni RIB public', async ({ page }) => {
    await expect(page.getByTestId('payment-methods-note').first()).toBeVisible();
    await expect(page.getByText('Paiement confirmé après validation pédagogique').first()).toBeVisible();
    await expect(page.getByText('Aucun identifiant bancaire sensible').first()).toBeVisible();

    const body = await page.textContent('body');
    expect(body).not.toContain(CGV_POLICY.payment.provider);
    expect(body).not.toContain(CGV_POLICY.payment.acceptedCards);
    expect(body).not.toContain(CGV_POLICY.payment.cardFee);
    expect(body).not.toContain(LEGAL.billing.bank);
    expect(body).not.toContain(LEGAL.billing.rib);
    expect(body).not.toContain(LEGAL.billing.iban);
  });

  test('page charge sans erreur 500', async ({ page }) => {
    const response = await page.request.get('/offres');
    expect(response.status()).toBeLessThan(500);
  });
});
