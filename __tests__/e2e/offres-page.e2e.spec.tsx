import { expect, test } from '@playwright/test';

test.describe('Page Offres E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/offres');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page se charge avec le hero et le h1', async ({ page }) => {
    const h1 = page.getByRole('heading', { level: 1, name: /Offres & tarifs/i });
    await expect(h1).toBeVisible();

    // Hero section has bg-lux-ink background
    const heroSection = page.locator('section.bg-lux-ink').first();
    await expect(heroSection).toBeVisible();

    // Catalogue eyebrow is visible
    await expect(page.getByText('Catalogue 2026/2027')).toBeVisible();
  });

  test('barre de filtre sticky est visible avec toutes les categories', async ({ page }) => {
    const filterNav = page.getByRole('navigation', { name: /Filtres des offres/i });
    await expect(filterNav).toBeVisible();

    const expectedCategories = [
      'Tout voir',
      'Parcours annuels',
      'Candidat libre',
      'Plateforme',
      'Les Intensifs',
      'Prépa épreuves',
      'Boussole',
      'Pass',
      'Carte Nexus',
    ];

    for (const label of expectedCategories) {
      await expect(filterNav.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test('filtre par categorie affiche la section correspondante', async ({ page }) => {
    const filterNav = page.getByRole('navigation', { name: /Filtres des offres/i });

    // Click "Carte Nexus" filter — should show only Carte Nexus section
    await filterNav.getByRole('button', { name: 'Carte Nexus' }).click();

    await expect(page.getByRole('heading', { name: /L'accompagnement Nexus toute l'année/i })).toBeVisible();

    // Other sections should not be visible
    await expect(page.getByRole('heading', { name: /Accompagnement annuel — scolarisés/i })).toBeHidden();
    await expect(page.getByRole('heading', { name: /Stages intensifs/i })).toBeHidden();

    // Click "Tout voir" — all sections reappear
    await filterNav.getByRole('button', { name: 'Tout voir' }).click();

    await expect(page.getByRole('heading', { name: /Accompagnement annuel — scolarisés/i })).toBeVisible();
  });

  test('filtre Les Intensifs affiche les formats de stage', async ({ page }) => {
    const filterNav = page.getByRole('navigation', { name: /Filtres des offres/i });

    await filterNav.getByRole('button', { name: 'Les Intensifs' }).click();

    await expect(page.getByRole('heading', { name: /Stages intensifs/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Calendrier des éditions/i })).toBeVisible();
  });

  test('FAQ s\'affiche et l\'accordeon fonctionne', async ({ page }) => {
    const faqHeading = page.getByRole('heading', { name: /Questions sur les tarifs/i });
    await faqHeading.scrollIntoViewIfNeeded();
    await expect(faqHeading).toBeVisible();

    // First FAQ question
    const firstQuestion = page.getByRole('button', { name: /Les tarifs sont-ils en TND/i });
    await expect(firstQuestion).toBeVisible();
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false');

    // Click to expand
    await firstQuestion.click();
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true');

    // Answer content is visible
    await expect(page.getByText(/dinars tunisiens/i)).toBeVisible();

    // Click again to collapse
    await firstQuestion.click();
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false');
  });

  test('boutons CTA sont presents', async ({ page }) => {
    // "Reserver ma place" buttons on cards
    const reserveButtons = page.getByRole('link', { name: /Réserver ma place/i });
    await expect(reserveButtons.first()).toBeVisible();

    // Bottom CTA section
    const ctaSection = page.getByRole('heading', { name: /Besoin d'aide pour choisir/i });
    await ctaSection.scrollIntoViewIfNeeded();
    await expect(ctaSection).toBeVisible();

    const findFormula = page.getByRole('link', { name: /Trouver ma formule/i });
    await expect(findFormula).toBeVisible();
    await expect(findFormula).toHaveAttribute('href', '/recommandation');
  });

  test('hero affiche les repères clés', async ({ page }) => {
    await expect(page.getByText(/Groupes de 5 maximum/)).toBeVisible();
    await expect(page.getByText(/Tarifs en TND/)).toBeVisible();
  });

  test('WhatsApp link est present dans la section CTA finale', async ({ page }) => {
    const whatsapp = page.getByRole('link', { name: /WhatsApp/i });
    await whatsapp.scrollIntoViewIfNeeded();
    await expect(whatsapp).toBeVisible();
    await expect(whatsapp).toHaveAttribute('target', '_blank');
  });
});
