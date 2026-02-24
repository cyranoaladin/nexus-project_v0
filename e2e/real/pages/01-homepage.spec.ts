import { test, expect } from '@playwright/test';

/**
 * REAL AUDIT — Homepage (/)
 *
 * Structure réelle de la navbar : CorporateNavbar avec dropdowns
 * - "Essentiel" dropdown → Accueil, Offres, Bilan Gratuit, Contact
 * - "Programmes" dropdown → Accompagnement, Stages, ARIA
 * - "À propos" dropdown → Équipe, Centre
 * - "Connexion" dropdown → Se connecter, S'inscrire
 * - CTA "Bilan gratuit" (lien direct desktop)
 *
 * Hero CTA : Button asChild → Link href="/bilan-gratuit" et Link href="/offres"
 */

test.describe('REAL — Homepage (/)', () => {
  let consoleErrors: string[] = [];
  let networkErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    networkErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[Console Error] ${msg.text()}`);
    });
    page.on('response', (resp) => {
      if (resp.status() >= 400) networkErrors.push(`[${resp.status()}] ${resp.url()}`);
    });

    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('HTTP 200 — La page charge sans erreur serveur', async ({ page }) => {
    const response = await page.request.get('/');
    expect(response.status(), 'La homepage retourne une erreur serveur !').toBe(200);
  });

  test('Zéro erreur console JavaScript critique', async ({ page }) => {
    await page.waitForTimeout(3000);
    const realErrors = consoleErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('ResizeObserver') &&
        !e.includes('Non-Error promise rejection') &&
        !e.includes('hot-update') &&
        !e.includes('webpack') &&
        !e.includes('next-dev') &&
        !e.includes('Hydration') &&
        !e.includes('Warning')
    );
    if (realErrors.length > 0) {
      console.log('ERREURS CONSOLE TROUVÉES:', JSON.stringify(realErrors, null, 2));
    }
    expect(realErrors, `Erreurs console trouvées :\n${realErrors.join('\n')}`).toHaveLength(0);
  });

  test('Zéro erreur réseau (pas de 404/500)', async ({ page }) => {
    await page.waitForTimeout(3000);
    const realNetworkErrors = networkErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('hot-update') &&
        !e.includes('_next/webpack') &&
        !e.includes('_next/static')
    );
    if (realNetworkErrors.length > 0) {
      console.log('ERREURS RÉSEAU TROUVÉES:', JSON.stringify(realNetworkErrors, null, 2));
    }
    expect(realNetworkErrors, `Erreurs réseau :\n${realNetworkErrors.join('\n')}`).toHaveLength(0);
  });

  test('H1 titre principal visible et non vide', async ({ page }) => {
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    const h1Text = await h1.textContent();
    expect(h1Text?.trim().length, 'H1 est vide').toBeGreaterThan(0);
    console.log(`H1 contenu: "${h1Text?.trim()}"`);
  });

  // NAVBAR — Dropdown "Essentiel" → Offres
  test('Navbar dropdown Essentiel → lien Offres navigue vers /offres', async ({ page }) => {
    const essentielBtn = page.locator('button').filter({ hasText: /essentiel/i }).first();
    await expect(essentielBtn).toBeVisible();
    await essentielBtn.hover();
    await page.waitForTimeout(600);

    const offresLink = page.locator('[role="menu"] a[href="/offres"]');
    await expect(offresLink, 'Lien Offres absent du dropdown Essentiel').toBeVisible();
    await offresLink.click();
    await page.waitForURL('**/offres**', { timeout: 10000 });
    expect(page.url()).toContain('/offres');
  });

  // NAVBAR — Dropdown "Essentiel" → Bilan Gratuit
  test('Navbar dropdown Essentiel → lien Bilan Gratuit navigue vers /bilan-gratuit', async ({ page }) => {
    const essentielBtn = page.locator('button').filter({ hasText: /essentiel/i }).first();
    await essentielBtn.hover();
    await page.waitForTimeout(600);

    const bilanLink = page.locator('[role="menu"] a[href="/bilan-gratuit"]');
    await expect(bilanLink, 'Lien Bilan Gratuit absent du dropdown').toBeVisible();
    await bilanLink.click();
    await page.waitForURL('**/bilan-gratuit**', { timeout: 10000 });
    expect(page.url()).toContain('/bilan-gratuit');
  });

  // NAVBAR — Dropdown "Essentiel" → Contact
  test('Navbar dropdown Essentiel → lien Contact navigue vers /contact', async ({ page }) => {
    const essentielBtn = page.locator('button').filter({ hasText: /essentiel/i }).first();
    await essentielBtn.hover();
    await page.waitForTimeout(600);

    const contactLink = page.locator('[role="menu"] a[href="/contact"]');
    await expect(contactLink, 'Lien Contact absent du dropdown').toBeVisible();
    await contactLink.click();
    await page.waitForURL('**/contact**', { timeout: 10000 });
    expect(page.url()).toContain('/contact');
  });

  // NAVBAR — Dropdown "Connexion" → Se connecter
  test('Navbar dropdown Connexion → Se connecter navigue vers /auth/signin', async ({ page }) => {
    const connexionBtn = page.locator('button').filter({ hasText: /connexion/i }).first();
    await expect(connexionBtn).toBeVisible();
    await connexionBtn.hover();
    await page.waitForTimeout(600);

    const signinLink = page.locator('[role="menu"] a[href="/auth/signin"]');
    await expect(signinLink, 'Lien Se connecter absent du dropdown Connexion').toBeVisible();
    await signinLink.click();
    await page.waitForURL('**/auth/signin**', { timeout: 10000 });
    expect(page.url()).toContain('/auth/signin');
  });

  // NAVBAR — CTA direct "Bilan gratuit" (desktop)
  test('Navbar CTA direct Bilan gratuit navigue vers /bilan-gratuit', async ({ page }) => {
    const ctaLink = page.locator('header a[href="/bilan-gratuit"]');
    const count = await ctaLink.count();
    console.log(`CTA Bilan gratuit dans header: ${count} trouvé(s)`);
    if (count > 0) {
      await ctaLink.first().click();
      await page.waitForURL('**/bilan-gratuit**', { timeout: 10000 });
      expect(page.url()).toContain('/bilan-gratuit');
    }
  });

  // HERO — CTA "Bilan gratuit"
  test('Hero CTA "Bilan gratuit" navigue vers /bilan-gratuit', async ({ page }) => {
    const heroCTA = page.locator('#hero a[href="/bilan-gratuit"]').first();
    await expect(heroCTA, 'CTA Bilan gratuit absent du Hero').toBeVisible();
    await heroCTA.click();
    await page.waitForURL('**/bilan-gratuit**', { timeout: 10000 });
    expect(page.url()).toContain('/bilan-gratuit');
  });

  // HERO — CTA "Voir nos offres"
  test('Hero CTA "Voir nos offres" navigue vers /offres', async ({ page }) => {
    const offresCTA = page.locator('#hero a[href="/offres"]').first();
    await expect(offresCTA, 'CTA Voir nos offres absent du Hero').toBeVisible();
    await offresCTA.click();
    await page.waitForURL('**/offres**', { timeout: 10000 });
    expect(page.url()).toContain('/offres');
  });

  // FOOTER — Tous les liens internes
  test('Tous les liens internes du footer retournent HTTP 200', async ({ page }) => {
    const footerLinks = page.locator('footer a[href^="/"]');
    const count = await footerLinks.count();
    console.log(`Footer: ${count} liens internes trouvés`);
    expect(count, 'Footer sans liens internes').toBeGreaterThan(0);

    const brokenLinks: string[] = [];
    for (let i = 0; i < count; i++) {
      const href = await footerLinks.nth(i).getAttribute('href');
      if (href && href.startsWith('/')) {
        const response = await page.request.get(href);
        if (response.status() !== 200) {
          brokenLinks.push(`${href} → HTTP ${response.status()}`);
        }
      }
    }

    if (brokenLinks.length > 0) {
      console.log('LIENS FOOTER CASSÉS:', brokenLinks);
    }
    expect(brokenLinks, `Liens footer cassés :\n${brokenLinks.join('\n')}`).toHaveLength(0);
  });

  test('/mentions-legales retourne HTTP 200', async ({ page }) => {
    const resp = await page.request.get('/mentions-legales');
    expect(resp.status()).toBe(200);
  });

  test('/conditions retourne HTTP 200', async ({ page }) => {
    const resp = await page.request.get('/conditions');
    expect(resp.status()).toBe(200);
  });
});
