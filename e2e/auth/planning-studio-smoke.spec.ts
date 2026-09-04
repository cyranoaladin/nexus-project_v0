/**
 * Planning Studio — smoke multi-navigateurs.
 *
 * La suite complète tourne sur Chromium. Ce fichier couvre le parcours
 * essentiel sur Firefox et WebKit : si l'un d'eux se comporte différemment,
 * cela doit se voir ici et être corrigé, jamais déclaré comme dette.
 */
import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

test.describe('Planning Studio — parcours essentiel', () => {
  test('chargement, semaine, panneau, édition et enregistrement', async ({ page }) => {
    await loginAsUser(page, 'admin');

    // Chargement et rendu de la semaine
    await page.goto('/planning', { waitUntil: 'networkidle' });
    await expect(page.locator('#gridWrap')).toBeVisible();
    await expect(page.locator('.card').first()).toBeVisible();
    const cards = await page.locator('.card').count();
    expect(cards, 'la grille porte des séances').toBeGreaterThan(10);

    // Le panneau s'ouvre sur une séance et affiche son détail
    await page.locator('.card').first().click();
    await expect(page.locator('#sideBody')).toBeVisible();

    // Menu d'actions : ouverture, navigation clavier, fermeture par Échap
    await page.click('#btnMore');
    expect(await page.getAttribute('#btnMore', 'aria-expanded')).toBe('true');
    await expect(page.locator('#btnExportCsv')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await page.getAttribute('#btnMore', 'aria-expanded')).toBe('false');

    // Écriture serveur puis relecture : la révision progresse
    const before = await page.request.get('/api/planning-studio');
    expect(before.status()).toBe(200);
    const doc = (await before.json()) as { document: { revision: number }; payload: Record<string, unknown> };
    const payload = JSON.parse(JSON.stringify(doc.payload)) as { meta: Record<string, unknown> };
    payload.meta.title = `Smoke ${Date.now()}`;
    const put = await page.request.put('/api/planning-studio', {
      data: { expectedRevision: doc.document.revision, payload, action: 'SAVE', summary: 'smoke multi-navigateurs' },
    });
    expect(put.status(), await put.text()).toBe(200);
    expect(((await put.json()) as { revision: number }).revision).toBe(doc.document.revision + 1);
  });

  test('navigation mobile : sélecteur de jour et absence de débordement', async ({ page }) => {
    await loginAsUser(page, 'admin');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/planning', { waitUntil: 'networkidle' });
    await page.waitForSelector('#gridWrap');

    const days = page.locator('#mobileDays button');
    expect(await days.count()).toBe(7);
    await days.nth(3).click();
    await expect(page.locator('.card').first()).toBeVisible();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
});
