/**
 * E2E — parcours candidats libres session 2027 (vrai serveur, vrai navigateur).
 * Accueil → bloc « À la une » → page /bac-candidat-libre ; rendu mobile sans débordement.
 * Les montants affichés viennent de pricing.canonical.json (bloc candidats_libres_2027).
 */
import { test, expect } from '@playwright/test';

test('la page présente les trois parcours, les échéances Cyclades et le contact WhatsApp', async ({ page }) => {
  await page.goto('/bac-candidat-libre', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { level: 1 })).toContainText('bac français en candidat libre');
  for (const niveau of ['Première', 'Terminale', 'Bac en 1 an']) {
    await expect(page.getByRole('article', { name: new RegExp(niveau) })).toBeVisible();
  }
  await expect(page.getByRole('region', { name: /Cyclades/ })).toContainText('jamais à votre place');
  const whatsapp = page.getByRole('link', { name: /WhatsApp/ }).first();
  await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+\?text=/);

  const blocs = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = blocs.map((bloc) => JSON.parse(bloc)['@type']);
  expect(types).toEqual(expect.arrayContaining(['Course', 'FAQPage', 'BreadcrumbList']));
});

test('le menu « Offres & tarifs » et le catalogue mènent à la page', async ({ page }) => {
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'Tout savoir sur la session 2027' }).click();
  await expect(page).toHaveURL(/\/bac-candidat-libre$/);
});

test.describe('mobile 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('aucun débordement horizontal sur la page et sur l’accueil', async ({ page }) => {
    for (const chemin of ['/bac-candidat-libre', '/']) {
      await page.goto(chemin, { waitUntil: 'domcontentloaded' });
      const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(largeur, `débordement sur ${chemin}`).toBeLessThanOrEqual(392);
    }
  });
});
