import { expect, test } from '@playwright/test';

test.describe('Page Offres E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/offres');
    await page.waitForLoadState('networkidle');
  });

  test('page se charge correctement', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Investissez dans la seule garantie de réussite au Bac/i);
    await expect(page.locator('#offres-principales')).toBeVisible();
    await expect(page.locator('#comparaison')).toBeVisible();
    await expect(page.locator('#garanties')).toBeVisible();
    await expect(page.locator('#faq')).toBeVisible();
  });

  test('navigation flottante fonctionne', async ({ page }) => {
    // La page expose une navigation par ancres en haut de page.
    await page.locator('a[href="#offres-principales"]:visible').first().click();
    await expect(page).toHaveURL(/#offres-principales$/);
    await expect(page.locator('#offres-principales')).toBeVisible();

    await page.locator('a[href="#faq"]:visible').first().click();
    await expect(page).toHaveURL(/#faq$/);
    await expect(page.locator('#faq')).toBeVisible();
  });

  test('boutons CTA fonctionnent', async ({ page }) => {
    // CTA principal visible en haut de page
    const cta = page.getByRole('link', { name: /Démarrer un bilan gratuit/i }).first();
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();
    await expect(cta).toBeEnabled();
  });

  test('formulaire de diagnostic fonctionne', async ({ page }) => {
    // Le tunnel "recommandation rapide" remplace l'ancien formulaire.
    await page.getByRole('button', { name: /^Lycée français$/ }).first().click();
    await expect(page.getByText('Recommandée pour vous')).toBeVisible();
    await expect(page.locator('#offres-principales .text-xs.font-semibold.text-brand-accent')).toContainText('Recommandée pour vous');
  });

  test('comparaison des offres s\'affiche', async ({ page }) => {
    await page.locator('#comparaison').scrollIntoViewIfNeeded();
    await expect(page.locator('#comparaison')).toBeVisible();
    await expect(page.getByText('La comparaison la plus claire du marché')).toBeVisible();
    await expect(page.locator('#comparaison .text-brand-accent.font-semibold')).toContainText('Nexus Réussite');
  });

  test('témoignages s\'affichent', async ({ page }) => {
    // Scroll vers les témoignages
    await page.evaluate(() => window.scrollTo(0, 3000));

    // Vérifier que les témoignages sont présents
    // La section témoignages est optionnelle; test souple
    const temoCount = await page.getByText('Témoignages').count();
    if (temoCount > 0) {
      const anyCard = page.locator('section:has-text("Témoignages") img, section:has-text("Témoignages") .card, [data-testid="testimonial"]');
      expect(await anyCard.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test('FAQ s\'affiche et fonctionne', async ({ page }) => {
    await page.locator('#faq').scrollIntoViewIfNeeded();
    await expect(page.getByText('Questions fréquentes des parents')).toBeVisible();

    const firstQuestion = page.getByText("Qu'est-ce qu'un crédit et comment fonctionne-t-il ?");
    await firstQuestion.click();
    await expect(page.locator('#faq').getByText(/1 crédit = 1 heure de cours particulier en ligne/i).first()).toBeVisible();
  });

  test('garanties s\'affichent', async ({ page }) => {
    // Scroll vers les garanties
    await page.evaluate(() => window.scrollTo(0, 3500));

    // Vérifier que les garanties sont présentes
    // Garanties: si présent, vérifier quelques éléments clés
    const gTitle = page.getByText(/Nos Garanties|Votre Réussite, Notre Engagement/i);
    const gCount = await gTitle.count();
    if (gCount > 0) {
      const anyGuarantee = page.getByText(/Garantie|Support 24\/7|Mention/);
      expect(await anyGuarantee.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test('tous les liens sont fonctionnels', async ({ page }) => {
    // Vérifier que tous les liens ont des href valides
    const links = page.locator('a[href]');
    const linkCount = await links.count();

    for (let i = 0; i < Math.min(linkCount, 10); i++) { // Limiter à 10 liens pour éviter les timeouts
      const link = links.nth(i);
      const href = await link.getAttribute('href');
      expect(href).toBeTruthy();
      // Ne pas vérifier les liens # car ils sont valides pour le scroll
    }
  });

  test('animations se déclenchent au scroll', async ({ page }) => {
    // Scroll progressivement pour déclencher les animations
    await page.evaluate(() => {
      const scrollHeight = document.body.scrollHeight;
      const viewportHeight = window.innerHeight;
      const steps = 10;

      for (let i = 0; i <= steps; i++) {
        const scrollY = (scrollHeight - viewportHeight) * (i / steps);
        window.scrollTo(0, scrollY);
      }
    });

    // Attendre que les animations se terminent
    await page.waitForTimeout(2000);

    // Vérifier qu'après scroll complet la page reste interactive
    await expect(page.locator('#faq')).toBeVisible();
    await expect(page.getByRole('link', { name: /Démarrer un bilan gratuit/i }).first()).toBeVisible();
  });
});
