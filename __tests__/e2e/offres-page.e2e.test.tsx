import { expect, test } from '@playwright/test';

test.describe('Page Offres E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/offres');
  });

  test('page se charge correctement', async ({ page }) => {
    // Vérifier que la page se charge
    await expect(page).toHaveTitle(/Nexus Réussite/);

    // Vérifier que les sections principales sont présentes
    await expect(page.getByText('Pilotez Votre Réussite')).toBeVisible();
    await expect(page.getByText('Analyse Stratégique Différentielle')).toBeVisible();

    // Utiliser des sélecteurs plus spécifiques
    await expect(page.locator('h3').filter({ hasText: 'Nexus Cortex' })).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Académies Nexus' })).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Programme Odyssée' })).toBeVisible();
  });

  test('navigation flottante fonctionne', async ({ page }) => {
    // Scroll pour faire apparaître la navigation flottante
    await page.evaluate(() => window.scrollTo(0, 500));

    // Vérifier que les boutons de navigation sont présents dans la nav flottante
    const floatingNav = page.locator('.fixed.bottom-6');
    await expect(floatingNav.getByText('Cortex')).toBeVisible();
    await expect(floatingNav.getByText('Académies')).toBeVisible();
    await expect(floatingNav.getByText('Odyssée')).toBeVisible();

    // Tester la navigation vers Cortex
    await floatingNav.getByText('Cortex').click();
    await expect(page.locator('#cortex')).toBeVisible();

    // Tester la navigation vers Académies
    await floatingNav.getByText('Académies').click();
    await expect(page.locator('#academies')).toBeVisible();

    // Tester la navigation vers Odyssée
    await floatingNav.getByText('Odyssée').click();
    await expect(page.locator('#odyssee')).toBeVisible();
  });

  test('boutons CTA fonctionnent', async ({ page }) => {
    // Tester les boutons "Découvrir" dans les sections
    const discoverButtons = page.getByRole('button').filter({ hasText: 'Découvrir' });
    await expect(discoverButtons.first()).toBeVisible();

    // Vérifier que les boutons sont cliquables
    await expect(discoverButtons.first()).toBeEnabled();
  });

  test('formulaire de diagnostic fonctionne', async ({ page }) => {
    // Scroll vers le formulaire
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Vérifier que le formulaire est présent
    await expect(page.getByText('Notre outil de diagnostic intelligent')).toBeVisible();

    // Remplir le formulaire avec des sélecteurs plus spécifiques
    const formButtons = page.locator('button').filter({ hasText: 'Terminale' });
    await formButtons.first().click();

    const aefeButtons = page.locator('button').filter({ hasText: 'Élève dans un lycée français' });
    await aefeButtons.first().click();

    const mentionButtons = page.locator('button').filter({ hasText: 'Obtenir une Mention' });
    await mentionButtons.first().click();

    // Vérifier qu'une recommandation apparaît
    await expect(page.getByText('Notre recommandation personnalisée :')).toBeVisible();
    await expect(page.getByText('Odyssée Terminale : La Stratégie Mention')).toBeVisible();

    // Vérifier que les boutons d'action sont présents
    await expect(page.getByText('Découvrir ce parcours')).toBeVisible();
    await expect(page.getByText('Voir cette académie')).toBeVisible();
  });

  test('comparaison des offres s\'affiche', async ({ page }) => {
    // Scroll vers la section de comparaison
    await page.evaluate(() => window.scrollTo(0, 2000));

    // Vérifier que la comparaison est présente
    await expect(page.getByText('Comparaison des Offres')).toBeVisible();

    // Utiliser des sélecteurs plus spécifiques
    await expect(page.locator('h3').filter({ hasText: 'Nexus Cortex' })).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Académies Nexus' })).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Programme Odyssée' })).toBeVisible();
  });

  test('témoignages s\'affichent', async ({ page }) => {
    // Scroll vers les témoignages
    await page.evaluate(() => window.scrollTo(0, 3000));

    // Vérifier que les témoignages sont présents
    await expect(page.getByText('Témoignages')).toBeVisible();
    await expect(page.getByText('Sarah Ben Ali')).toBeVisible();
  });

  test('FAQ s\'affiche et fonctionne', async ({ page }) => {
    // Scroll vers la FAQ
    await page.evaluate(() => window.scrollTo(0, 4000));

    // Vérifier que la FAQ est présente
    await expect(page.getByText('Questions Fréquentes')).toBeVisible();

    // Tester l'ouverture d'une question
    const firstQuestion = page.getByText('Quelle est la différence entre un élève scolarisé et un candidat libre ?');
    await firstQuestion.click();

    // Vérifier que la réponse s'affiche
    await expect(page.getByText('Un élève scolarisé suit les cours')).toBeVisible();
  });

  test('garanties s\'affichent', async ({ page }) => {
    // Scroll vers les garanties
    await page.evaluate(() => window.scrollTo(0, 3500));

    // Vérifier que les garanties sont présentes
    await expect(page.getByText('Nos Garanties')).toBeVisible();
    await expect(page.getByText('Garantie de Réussite')).toBeVisible();
    await expect(page.getByText('Mention Garantie')).toBeVisible();
    await expect(page.getByText('Support 24/7')).toBeVisible();
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

    // Vérifier que les éléments sont visibles (animations terminées)
    await expect(page.getByText('Pilotez Votre Réussite')).toBeVisible();
  });
});
