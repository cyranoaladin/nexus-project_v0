import { test, expect } from '@playwright/test';

test.describe('Nexus Maths-1ere Refonte Premium', () => {
  test.beforeEach(async ({ page }) => {
    // On simule une authentification ou on navigue directement
    await page.goto('/programme/maths-1ere');
  });

  test('affichage du hero pédagogique et des indicateurs de stage', async ({ page }) => {
    const hero = page.locator('text=Maths Première — Épreuve anticipée 2026');
    await expect(hero).toBeVisible();
    
    // Vérifier la présence des indicateurs de progression
    await expect(page.locator('text=Progression globale')).toBeVisible();
    await expect(page.locator('text=Niveau de préparation')).toBeVisible();
  });

  test('accès à la séance du jour', async ({ page }) => {
    // Vérifier le bloc séance du jour
    const sessionBlock = page.locator('text=FOCUS : SÉANCE DU JOUR');
    await expect(sessionBlock).toBeVisible();
  });

  test('fonctionnement du panneau de remédiation RAG', async ({ page }) => {
    // Naviguer vers un chapitre ou utiliser le cockpit
    await page.click('button:has-text("Démarrer")');
    
    // Chercher le bouton d'aide IA/RAG
    const ragButton = page.locator('button:has-text("Assistant")');
    if (await ragButton.isVisible()) {
      await ragButton.click();
      await expect(page.locator('text=Réponse de l\'Assistant Nexus')).toBeVisible();
    }
  });

  test('vue enseignant : heatmap et groupes de besoin', async ({ page }) => {
    // Simuler le passage en vue enseignant
    // Note: Dans une vraie appli, cela dépend du rôle JWT
    await page.evaluate(() => {
      window.localStorage.setItem('nexus-debug-role', 'teacher');
    });
    await page.reload();
    
    await expect(page.locator('text=Cockpit Expert Enseignant')).toBeVisible();
    
    // Vérifier la heatmap
    await page.click('button:has-text("Compétences")');
    await expect(page.locator('.grid-cols-10')).toBeVisible(); // Heatmap 10 compétences
  });

  test('cohérence des dates de stage', async ({ page }) => {
    await expect(page.locator('text=20 avril – 1er mai 2026')).toBeVisible();
  });
});
