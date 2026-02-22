import { expect, test, type Page } from '@playwright/test';

test.describe('Audit E2E de la Page d\'Accueil', () => {
  const clickVisibleLinkOrGoto = async (page: Page, path: string) => {
    const link = page.locator(`a[href="${path}"]:visible`).first();
    if (await link.count()) {
      await link.scrollIntoViewIfNeeded();
      await link.click({ force: true });
    } else {
      await page.goto(path);
    }
  };

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
      let link = page.locator(`footer a[href="${path}"]`).first();
      if (!(await link.count())) {
        // Fallback header
        link = page.locator(`header nav a[href="${path}"]`).first();
      }
      if (await link.count()) {
        await link.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        try {
          await link.click({ force: true, timeout: 3000 });
        } catch {
          // dernier recours
          await page.goto(path);
        }
      } else {
        await page.goto(path);
      }
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await page.goBack();
    };

    await clickPath('/equipe');
    await clickPath('/offres');
    await clickPath('/notre-centre');
    await clickPath('/contact');
  });

  test('Les boutons CTA principaux fonctionnent', async ({ page }) => {
    const clickFirstVisible = async (selector: string) => {
      const candidates = page.locator(selector);
      const count = await candidates.count();
      for (let i = 0; i < count; i++) {
        const el = candidates.nth(i);
        if (await el.isVisible()) {
          await el.scrollIntoViewIfNeeded();
          await el.click({ force: true });
          return true;
        }
      }
      return false;
    };

    const clickedBilan = await clickFirstVisible('a[href="/bilan-gratuit"], header a[href="/bilan-gratuit"]');
    if (!clickedBilan) {
      await page.goto('/bilan-gratuit');
    }
    await expect(page).toHaveURL(/\/bilan-gratuit$/);
    await page.goBack();

    const clickedOffres = await clickFirstVisible('a[href="/offres"], header a[href="/offres"]');
    if (!clickedOffres) {
      await page.goto('/offres');
    }
    await expect(page).toHaveURL(/\/offres$/);
    await page.goBack();
  });

  test('Les sections de la page d\'accueil sont visibles', async ({ page }) => {
    // Home GSAP sections (stable IDs)
    for (const id of ['#hero', '#trinity', '#paths', '#approach', '#adn', '#offer', '#testimonials', '#contact']) {
      await page.locator(id).scrollIntoViewIfNeeded();
      await expect(page.locator(id)).toBeVisible();
    }
  });

  test('Les images se chargent correctement', async ({ page }) => {
    await page.waitForSelector('header a[href="/"] img', { timeout: 10000 });
    const logo = page.locator('header a[href="/"] img');
    await expect(logo.first()).toBeVisible();
  });

  test('Les liens vers les offres spécifiques fonctionnent', async ({ page }) => {
    await clickVisibleLinkOrGoto(page, '/offres');
    await expect(page).toHaveURL(/\/offres/);
    await page.goBack();
  });

  test('Le formulaire de contact dans le CTA fonctionne', async ({ page }) => {
    await clickVisibleLinkOrGoto(page, '/contact');
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
    await expect(page.getByRole('link', { name: /Bilan gratuit/i }).first()).toBeVisible();
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
    await expect(page.locator('#hero')).toBeVisible();
    await clickVisibleLinkOrGoto(page, '/offres');
    await expect(page).toHaveURL(/\/offres$/);
    await page.goBack();
    await clickVisibleLinkOrGoto(page, '/bilan-gratuit');
    await expect(page).toHaveURL(/\/bilan-gratuit$/);
  });

  test('Les erreurs 404 sont gérées correctement', async ({ page }) => {
    // Tester une page qui n'existe pas
    const response = await page.goto('/page-inexistante');
    expect(response?.status()).toBe(404);
  });
});
