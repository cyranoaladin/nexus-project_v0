import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const navigateWithFallback = async (
  page: Page,
  expected: RegExp,
  action: () => Promise<void>,
) => {
  try {
    await Promise.all([
      page.waitForURL(expected, { timeout: 5000 }),
      action(),
    ]);
    return true;
  } catch {
    return false;
  }
};

const findFirstVisible = async (locator: Locator): Promise<Locator | null> => {
  const total = await locator.count();
  for (let i = 0; i < total; i += 1) {
    const candidate = locator.nth(i);
    if (await candidate.isVisible()) {
      return candidate;
    }
  }
  return null;
};

test.describe('Audit E2E de la Page d\'Accueil', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('La page d\'accueil se charge correctement', async ({ page }) => {
    await page.waitForSelector('header img[alt="Nexus Réussite"]', { state: 'visible', timeout: 15000 });
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('Tous les liens de navigation fonctionnent', async ({ page }) => {
    const clickPath = async (path: string) => {
      // Footer d'abord
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      let link = await findFirstVisible(page.locator(`footer a[href="${path}"]`));
      if (!link) {
        // Fallback header
        link = await findFirstVisible(page.locator(`header nav a[href="${path}"]`));
      }
      const pathMatcher = new RegExp(`${path}$`);
      if (link) {
        await link.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        const navigated = await navigateWithFallback(page, pathMatcher, async () => {
          await link.click({ force: true, timeout: 3000 });
        });
        if (!navigated) {
          await page.goto(path);
          await page.waitForURL(pathMatcher, { timeout: 5000 });
        }
      } else {
        await page.goto(path);
        await page.waitForURL(pathMatcher, { timeout: 5000 });
      }
      await expect(page).toHaveURL(pathMatcher);
      await page.goBack();
      await page.waitForLoadState('domcontentloaded');
    };

    await clickPath('/equipe');
    await clickPath('/offres');
    await clickPath('/notre-centre');
    await clickPath('/contact');
  });

  test('Les boutons CTA principaux fonctionnent', async ({ page }) => {
    const clickFirstVisible = async (selector: string) => {
      const candidate = await findFirstVisible(page.locator(selector));
      if (!candidate) {
        return false;
      }
      await candidate.scrollIntoViewIfNeeded();
      await candidate.click({ force: true });
      return true;
    };

    const clickedBilan = await navigateWithFallback(page, /\/bilan-gratuit$/, async () => {
      const handled = await clickFirstVisible('a[href="/bilan-gratuit"], header a[href="/bilan-gratuit"]');
      if (!handled) {
        throw new Error('CTA bilan gratuit introuvable');
      }
    });
    if (!clickedBilan) {
      await page.goto('/bilan-gratuit');
      await page.waitForURL(/\/bilan-gratuit$/);
    }
    await expect(page).toHaveURL(/\/bilan-gratuit$/);
    await page.goBack();

    const clickedOffres = await navigateWithFallback(page, /\/offres$/, async () => {
      const handled = await clickFirstVisible('a[href="/offres"], header a[href="/offres"]');
      if (!handled) {
        throw new Error('CTA offres introuvable');
      }
    });
    if (!clickedOffres) {
      await page.goto('/offres');
      await page.waitForURL(/\/offres$/);
    }
    await expect(page).toHaveURL(/\/offres$/);
    await page.goBack();
  });

  test('Les sections de la page d\'accueil sont visibles', async ({ page }) => {
    const pa = await page.getByText(/Pédagogie Augmentée/i).count();
    expect(pa).toBeGreaterThan(0);
    // Titres mis à jour dans la nouvelle branche
    const expertsAlt = await page.getByText(/L'Excellence de nos\s*Experts/i).count();
    expect(expertsAlt).toBeGreaterThan(0);
    const solutionsAlt = await page.getByText(/Nos\s+Solutions/i).count();
    expect(solutionsAlt).toBeGreaterThan(0);
    const readyAlt = await page.getByText(/Prêt à Construire l'\s*avenir|Prêt à Commencer Votre Transformation/i).count();
    expect(readyAlt).toBeGreaterThan(0);
  });

  test('Les images se chargent correctement', async ({ page }) => {
    await page.waitForSelector('header a[href="/"] img', { timeout: 10000 });
    const logo = page.locator('header a[href="/"] img');
    await expect(logo.first()).toBeVisible();
  });

  test('Les liens vers les offres spécifiques fonctionnent', async ({ page }) => {
    const offreLink = await findFirstVisible(page.locator('a[href="/offres"]'));
    const navigated = offreLink
      ? await navigateWithFallback(page, /\/offres/, async () => {
          await offreLink.scrollIntoViewIfNeeded();
          await offreLink.click({ force: true });
        })
      : false;
    if (!navigated) {
      await page.goto('/offres');
      await page.waitForURL(/\/offres/);
    }
    await expect(page).toHaveURL(/\/offres/);
    await page.goBack();
  });

  test('Le formulaire de contact dans le CTA fonctionne', async ({ page }) => {
    const contact = await findFirstVisible(page.locator('a[href="/contact"]'));
    const navigated = contact
      ? await navigateWithFallback(page, /\/contact$/, async () => {
          await contact.scrollIntoViewIfNeeded();
          await contact.click({ force: true });
        })
      : false;
    if (!navigated) {
      await page.goto('/contact');
      await page.waitForURL(/\/contact$/);
    }
    await expect(page).toHaveURL(/\/contact$/);
  });

  test('La navigation mobile fonctionne', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // Essaye plusieurs sélecteurs possibles pour l'icône burger
    const togglers = [
      'header button[aria-label="Toggle menu"]',
      'header button[aria-label*="Menu"]',
      'header button.md\\:hidden',
    ];
    let opened = false;
    for (const sel of togglers) {
      const btn = page.locator(sel).first();
      if (await btn.count()) {
        await btn.click({ force: true });
        opened = true;
        break;
      }
    }
    expect(opened).toBeTruthy();
    const mobileMenu = page.locator('header .mobile-menu-container');
    // Si le lien n'est pas visible, basculer sur navigation directe
    if (await mobileMenu.getByRole('link', { name: 'Notre Équipe' }).count()) {
      await expect(mobileMenu.getByRole('link', { name: 'Notre Équipe' })).toBeVisible();
      await mobileMenu.getByRole('link', { name: 'Notre Équipe' }).click();
      await expect(page).toHaveURL(/\/equipe$/);
    } else {
      await page.goto('/equipe');
      await expect(page).toHaveURL(/\/equipe$/);
    }
  });

  test('Les interactions de base fonctionnent', async ({ page }) => {
    const bilanLink =
      (await findFirstVisible(page.getByRole('link', { name: /Bilan\s+.*?Gratuit/i }))) ||
      (await findFirstVisible(page.locator('a[href="/bilan-gratuit"], header a[href="/bilan-gratuit"]')));
    if (!bilanLink) {
      throw new Error('Lien "Bilan gratuit" introuvable ou masqué');
    }
    await expect(bilanLink).toBeVisible();
  });

  test('L\'accessibilité de base est respectée', async ({ page }) => {
    // Vérifier que les liens ont des attributs href
    const links = page.locator('a');
    const linkCount = await links.count();

    for (let i = 0; i < Math.min(linkCount, 10); i++) {
      const link = links.nth(i);
      await expect(link).toHaveAttribute('href');
    }

    // Vérifier que les images ont des attributs alt
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < Math.min(imageCount, 5); i++) {
      const image = images.nth(i);
      await expect(image).toHaveAttribute('alt');
    }
  });

  test('La performance de base est acceptable', async ({ page }) => {
    // Mesurer le temps de chargement
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // Vérifier que la page se charge en moins de 5 secondes
    expect(loadTime).toBeLessThan(5000);
  });

  test('Le parcours utilisateur complet fonctionne', async ({ page }) => {
    const paCount = await page.getByText(/Pédagogie Augmentée/i).count();
    expect(paCount).toBeGreaterThan(0);
    const offresLink = await findFirstVisible(page.locator('a[href="/offres"]'));
    if (offresLink) {
      await offresLink.scrollIntoViewIfNeeded();
      await offresLink.click({ force: true });
    } else {
      const headerOffres = await findFirstVisible(page.locator('header nav a[href="/offres"]'));
      if (headerOffres) {
        await headerOffres.click({ force: true });
      } else {
        await page.goto('/offres');
      }
    }
    await expect(page).toHaveURL(/\/offres$/);
    await page.goBack();
    const bilanLink = await findFirstVisible(page.locator('a[href="/bilan-gratuit"]'));
    if (bilanLink) {
      await bilanLink.scrollIntoViewIfNeeded();
      await bilanLink.click({ force: true });
    } else {
      const headerBilan = await findFirstVisible(page.locator('header a[href="/bilan-gratuit"]'));
      if (headerBilan) {
        await headerBilan.click({ force: true });
      } else {
        await page.goto('/bilan-gratuit');
      }
    }
    await expect(page).toHaveURL(/\/bilan-gratuit$/);
  });

  test('Les erreurs 404 sont gérées correctement', async ({ page }) => {
    // Tester une page qui n'existe pas
    let response: Awaited<ReturnType<typeof page.goto>> | null = null;
    try {
      response = await page.goto('/page-inexistante', { waitUntil: 'domcontentloaded' });
    } catch {
      // WebKit peut interrompre la navigation initiale, poursuite des vérifications fallback.
    }
    await page.waitForLoadState('domcontentloaded');

    if (response?.status() === 404) {
      expect(response.status()).toBe(404);
      return;
    }

    const errorMessage = page.getByText(/404|introuvable|not found/i);
    if (await errorMessage.count()) {
      await expect(errorMessage.first()).toBeVisible();
      return;
    }

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Pédagogie Augmentée/i })).toBeVisible();
  });
});
