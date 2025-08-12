import { test, expect } from '@playwright/test';

test.describe('Audit E2E de la Page d\'Accueil', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('La page d\'accueil se charge correctement', async ({ page }) => {
    await expect(page).toHaveTitle(/Nexus Réussite/);
    
    // Vérifier que les sections principales sont présentes
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('Tous les liens de navigation fonctionnent', async ({ page }) => {
    // Test des liens du header
    await page.click('text=Notre Équipe');
    await expect(page).toHaveURL('/equipe');
    await page.goBack();

    await page.click('text=Offres & Tarifs');
    await expect(page).toHaveURL('/offres');
    await page.goBack();

    await page.click('text=Notre Centre');
    await expect(page).toHaveURL('/notre-centre');
    await page.goBack();

    await page.click('text=Contact');
    await expect(page).toHaveURL('/contact');
    await page.goBack();
  });

  test('Les boutons CTA principaux fonctionnent', async ({ page }) => {
    // Test du bouton principal "Bilan Gratuit"
    await page.click('text=Commencer mon Bilan Stratégique Gratuit');
    await expect(page).toHaveURL('/bilan-gratuit');
    await page.goBack();

    // Test du bouton secondaire "Découvrir nos Offres"
    await page.click('text=Découvrir nos Offres');
    await expect(page).toHaveURL('/offres');
    await page.goBack();
  });

  test('Les sections de la page d\'accueil sont visibles', async ({ page }) => {
    // Hero Section
    await expect(page.locator('text=Votre Réussite Scolaire')).toBeVisible();
    
    // Pillars Section
    await expect(page.locator('text=L\'Excellence Augmentée')).toBeVisible();
    await expect(page.locator('text=Des Coachs d\'Exception')).toBeVisible();
    
    // Offers Preview Section
    await expect(page.locator('text=Des Parcours Adaptés à Chaque Ambition')).toBeVisible();
    await expect(page.locator('text=Nexus Cortex')).toBeVisible();
    await expect(page.locator('text=Le Studio Flex')).toBeVisible();
    await expect(page.locator('text=Les Académies Nexus')).toBeVisible();
    await expect(page.locator('text=Le Programme Odyssée')).toBeVisible();
    
    // CTA Section
    await expect(page.locator('text=Prêt à construire l\'avenir de votre enfant')).toBeVisible();
  });

  test('Les images se chargent correctement', async ({ page }) => {
    // Vérifier le logo
    const logo = page.locator('img[alt="Nexus Réussite"]');
    await expect(logo).toBeVisible();
    
    // Vérifier les images des piliers (si présentes)
    const pillarImages = page.locator('img[alt*="Accompagnement"]');
    await expect(pillarImages.first()).toBeVisible();
  });

  test('Les liens vers les offres spécifiques fonctionnent', async ({ page }) => {
    // Test des liens vers les sections d'offres
    await page.click('text=Nexus Cortex');
    await expect(page).toHaveURL(/\/offres/);
    await page.goBack();

    await page.click('text=Le Studio Flex');
    await expect(page).toHaveURL('/offres');
    await page.goBack();
  });

  test('Le formulaire de contact dans le CTA fonctionne', async ({ page }) => {
    // Scroll vers la section CTA
    await page.locator('text=Poser une Question').scrollIntoViewIfNeeded();
    
    // Cliquer sur le bouton de contact
    await page.click('text=Poser une Question');
    await expect(page).toHaveURL('/contact');
  });

  test('La navigation mobile fonctionne', async ({ page }) => {
    // Simuler un viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Ouvrir le menu mobile
    await page.click('button[aria-label="Menu mobile"], [role="button"]:has-text("Menu")');
    
    // Vérifier que le menu est ouvert
    await expect(page.locator('text=Notre Équipe')).toBeVisible();
    
    // Tester un lien du menu mobile
    await page.click('text=Notre Équipe');
    await expect(page).toHaveURL('/equipe');
  });

  test('Les animations et interactions fonctionnent', async ({ page }) => {
    // Test des hover effects sur les cartes d'offres
    const offerCard = page.locator('text=Nexus Cortex').locator('..').locator('..');
    await offerCard.hover();
    
    // Vérifier que l'animation de hover fonctionne (scale)
    await expect(offerCard).toHaveCSS('transform', /scale/);
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
    // Simuler un parcours utilisateur typique
    
    // 1. Arriver sur la page d'accueil
    await expect(page.locator('text=Votre Réussite Scolaire')).toBeVisible();
    
    // 2. Explorer les offres
    await page.click('text=Découvrir nos Offres');
    await expect(page).toHaveURL('/offres');
    
    // 3. Revenir et demander un bilan
    await page.goBack();
    await page.click('text=Commencer mon Bilan Stratégique Gratuit');
    await expect(page).toHaveURL('/bilan-gratuit');
    
    // 4. Vérifier que le formulaire est présent
    await expect(page.locator('form, input[type="email"]')).toBeVisible();
  });

  test('Les erreurs 404 sont gérées correctement', async ({ page }) => {
    // Tester une page qui n'existe pas
    const response = await page.goto('/page-inexistante');
    expect(response?.status()).toBe(404);
  });
});