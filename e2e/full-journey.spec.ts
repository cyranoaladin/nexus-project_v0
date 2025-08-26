import { expect, test } from '@playwright/test';

// Note: Pour exécuter ces E2E localement, assurez-vous que l'app tourne (npm run dev)
// et que vous avez des comptes de test/jeu de données seedés. Vous pouvez activer
// l'exécution en définissant E2E_RUN=1 dans l'environnement.

const E2E_ENABLED = process.env.E2E_RUN === '1';

(E2E_ENABLED ? test.describe : test.describe.skip)('Parcours complets critiques', () => {
  test.describe.configure({ mode: 'serial' });

  test('Accueil et navigation de base', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Nexus|Réussite|Accueil/i);
    await expect(page.locator('header')).toBeVisible();
    // Disambiguate by scoping to header navigation
    const nav = page.getByRole('navigation');
    await expect(
      nav.getByRole('link', {
        name: /Offres & Tarifs|Découvrir nos Offres|Voir Toutes Nos Offres/i,
      })
    ).toBeVisible();
  });

  test('Bilan gratuit - formulaire accessible', async ({ page }) => {
    await page.goto('/bilan-gratuit');
    // The page headline is "Créez Votre Compte Parent et Élève" and shows a badge "Bilan Stratégique Gratuit"
    await expect(page).toHaveURL(/\/bilan-gratuit$/);
    await expect(page.getByText(/Bilan Stratégique Gratuit/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Créez Votre Compte Parent/i })).toBeVisible();
  });

  test('Authentication - écran de connexion accessible', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('ARIA+ - présence du composant chat', async ({ page }) => {
    await page.goto('/');
    // Selon intégration, adapter le sélecteur
    await expect(page.getByRole('heading', { name: /IA ARIA/i })).toBeVisible();
  });
});
