import { test, expect } from '@playwright/test';

test.describe('Cockpit Enseignant - Génération Bilan', () => {
  test('devrait afficher le bilan avec le logo et la mise en forme correcte', async ({ page }) => {
    // 1. Accès à la page (Mock auth si nécessaire, ici on assume l'accès)
    await page.goto('/programme/maths-1ere');
    
    // 2. Aller sur l'onglet Enseignant
    await page.click('button:has-text("Enseignant")');
    
    // 3. Aller sur l'onglet Bilan
    await page.click('button:has-text("Bilan")');
    
    // 4. Vérifier la présence du logo dans le preview du bilan
    const logo = page.locator('#printable-bilan img[alt="Nexus Réussite"]');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', '/images/logo_slogan_nexus.png');
    
    // 5. Vérifier la présence des sections clés du bilan
    await expect(page.locator('#printable-bilan')).toContainText('Fiche de Bilan Individuelle');
    await expect(page.locator('#printable-bilan')).toContainText('Synthèse Pédagogique');
    
    // 6. Vérifier la mise en forme (background blanc pour impression)
    const printableBilan = page.locator('#printable-bilan');
    const backgroundColor = await printableBilan.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(backgroundColor).toBe('rgb(255, 255, 255)');
  });
});
