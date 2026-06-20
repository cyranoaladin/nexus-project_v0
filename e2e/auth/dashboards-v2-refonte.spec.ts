import { test, expect } from '@playwright/test';

test.describe('Refonte Dashboards V2', () => {
  
  test('Dashboard Élève - Unification EDS/STMG', async ({ page }) => {
    // Mock authentication as student
    // This assumes we have a way to bypass or use a test account
    await page.goto('/dashboard/eleve');
    
    // Check for core components
    await expect(page.locator('h1')).toContainText('Pilotage');
    await expect(page.locator('[data-testid="skill-graph"]')).toBeVisible();
    await expect(page.locator('text=Automatismes')).toBeVisible();
  });

  test('Dashboard Parent - Vue Famille', async ({ page }) => {
    await page.goto('/dashboard/parent');
    
    // Check for Family View components
    await expect(page.locator('h1')).toContainText('Espace Famille');
    await expect(page.locator('text=Mes Enfants')).toBeVisible();
    await expect(page.locator('text=Alertes & Notifications')).toBeVisible();
    
    // Click on a child card (if exists)
    const childCard = page.locator('text=Détails').first();
    if (await childCard.isVisible()) {
      await childCard.click();
      await expect(page.url()).toContain('/enfant/');
      await expect(page.locator('text=Evolution NexusIndex')).toBeVisible();
    }
  });

  test('Dashboard Coach - Pilotage de Cohorte', async ({ page }) => {
    await page.goto('/dashboard/coach');
    
    await expect(page.locator('h1')).toContainText('Espace Coach');
    await expect(page.locator('text=Pilotage de Cohorte')).toBeVisible();
    await expect(page.locator('text=Alertes Prioritaires')).toBeVisible();
    
    // Check for student table
    await expect(page.locator('table')).toBeVisible();
  });
});
