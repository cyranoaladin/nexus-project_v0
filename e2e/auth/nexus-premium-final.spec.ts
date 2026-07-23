import { test, expect } from '@playwright/test';

test.describe('Nexus premium final — contenu et parcours publics', () => {
  test('homepage contient les blocs publics non négociables', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const body = page.locator('body');

    for (const text of [
      'Trouver ma formule',
      'Groupes de 5 max',
      'Enseignants expérimentés',
      'Cellule Cyclades',
      'Repères tarifaires',
      'TND',
      'Demander un bilan gratuit',
    ]) {
      await expect(body).toContainText(text);
    }

    // Anti-régression : pas de prix barré, pas de promo, pas de faux chiffres
    await expect(body).not.toContainText('Forfait Excellence');
    await expect(body).not.toContainText('100 % réussite');
    await expect(body).not.toContainText('réussite garantie');
    await expect(body).not.toContainText('date limite');
    await expect(body).not.toContainText('période de réservation prioritaire');
  });

  test('navigation publique : /offres et /recommandation accessibles', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /Trouver ma formule/i }).first().click();
    await expect(page).toHaveURL(/\/recommandation/);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /offres/i }).first().click();
    await expect(page).toHaveURL(/\/offres/);
  });
});
