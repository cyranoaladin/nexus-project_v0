import { expect, test } from '@playwright/test';

/**
 * Dossiers « Inscription 2027 » : documents audités servis tels quels par un
 * rewrite. Ce test vérifie ce que le portage en composant aurait cassé — le
 * compte à rebours, la check-list mémorisée et les boutons de copie vivent
 * dans un <script> inline, qu'un HTML injecté n'exécuterait pas.
 */
const DOSSIERS = [
  { slug: 'general', cle: 'nexus-bac-general-2027-pieces', titre: /bac général 2027/i },
  { slug: 'stmg', cle: 'nexus-bac-stmg-2027-pieces', titre: /bac STMG 2027/i },
];

for (const dossier of DOSSIERS) {
  test.describe(`/inscription-bac-2027/${dossier.slug}`, () => {
    test('répond en 200, sans erreur de console, avec son titre et son logo', async ({ page }) => {
      const erreurs: string[] = [];
      page.on('console', (message) => { if (message.type() === 'error') erreurs.push(message.text()); });
      page.on('pageerror', (erreur) => erreurs.push(String(erreur)));

      const reponse = await page.goto(`/inscription-bac-2027/${dossier.slug}`);
      expect(reponse?.status()).toBe(200);
      await expect(page).toHaveTitle(dossier.titre);

      const logo = page.locator('.ident img.clair').first();
      await expect(logo).toBeVisible();
      const charge = await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
      expect(charge, 'le logo de la charte est réellement chargé').toBe(true);

      expect(erreurs, 'aucune erreur de console').toEqual([]);
    });

    test('le compte à rebours s’affiche et avance', async ({ page }) => {
      await page.goto(`/inscription-bac-2027/${dossier.slug}`);
      const compte = page.locator('#compte');
      await expect(compte).not.toBeEmpty();
      const premier = await compte.textContent();
      await expect.poll(async () => compte.textContent(), { timeout: 5_000 }).not.toBe(premier);
    });

    test('la check-list survit au rechargement', async ({ page }) => {
      await page.goto(`/inscription-bac-2027/${dossier.slug}`);
      const cases = page.locator('[data-liste] input[type=checkbox]');
      expect(await cases.count()).toBeGreaterThan(0);
      const premiere = cases.first();
      await premiere.check();
      const id = await premiere.getAttribute('id');
      await expect(page.locator('#avancement-txt')).toContainText('1 sur');

      await page.reload();
      await expect(page.locator(`#${id}`)).toBeChecked();
      const memoire = await page.evaluate((cle) => localStorage.getItem(cle), dossier.cle);
      expect(memoire, 'la clé localStorage n’a pas changé de nom').toContain(id!);
    });

    test('aucun débordement horizontal à 400 px', async ({ page }) => {
      await page.setViewportSize({ width: 400, height: 900 });
      await page.goto(`/inscription-bac-2027/${dossier.slug}`);
      const deborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(deborde).toBe(false);
    });

    test('le sommaire mène à des ancres qui existent', async ({ page }) => {
      await page.goto(`/inscription-bac-2027/${dossier.slug}`);
      const ancres = await page.locator('nav.plan a').evaluateAll(
        (liens) => liens.map((lien) => (lien as HTMLAnchorElement).getAttribute('href') ?? ''),
      );
      expect(ancres.length).toBeGreaterThan(5);
      for (const ancre of ancres) {
        expect(ancre.startsWith('#')).toBe(true);
        await expect(page.locator(ancre)).toHaveCount(1);
      }
    });
  });
}

test('l’index oriente vers les deux dossiers', async ({ page }) => {
  const reponse = await page.goto('/inscription-bac-2027');
  expect(reponse?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/baccalauréat français/i);
  for (const dossier of DOSSIERS) {
    await expect(page.locator(`a[href="/inscription-bac-2027/${dossier.slug}"]`)).toHaveCount(1);
  }
});
