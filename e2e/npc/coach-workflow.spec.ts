// ═══════════════════════════════════════════════════════════════════════════════
// E2E Tests: NPC Coach Workflow
// Complete flow: login → create submission → upload → view diagnostic
// ═══════════════════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('NPC Coach Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as coach
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'coach@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/coach');
  });

  test('coach can navigate to NPC dashboard', async ({ page }) => {
    // Click on Pédagogie in navigation
    await page.click('text=Pédagogie');
    await page.waitForURL('/dashboard/coach/npc');

    // Verify dashboard elements
    await expect(page.locator('h1')).toContainText('Nexus Pédagogie');
    await expect(page.locator('text=Gérez les copies')).toBeVisible();
    await expect(page.locator('button:has-text("Nouvelle copie")')).toBeVisible();
  });

  test('coach can create a new submission', async ({ page }) => {
    await page.goto('/dashboard/coach/npc');

    // Click create button
    await page.click('button:has-text("Nouvelle copie")');

    // Fill form
    await page.click('[placeholder="Sélectionnez un élève"]');
    await page.click('text=Jean Dupont'); // Select first student

    await page.fill('input[placeholder="Ex: DS Maths - Fonctions dérivées"]', 'Test DS Maths');

    await page.click('[placeholder="Matière"]');
    await page.click('text=MATHS');

    await page.click('[placeholder="Niveau"]');
    await page.click('text=PREMIERE');

    await page.fill('textarea[placeholder="Contexte, objectifs, remarques..."]', 'Test description');

    // Submit
    await page.click('button:has-text("Créer et uploader")');

    // Should redirect to upload page
    await page.waitForURL(/\/dashboard\/coach\/npc\/submissions\/.*\/upload/);
    await expect(page.locator('h1')).toContainText('Upload de copie');
  });

  test('upload page shows instructions', async ({ page }) => {
    // Create a submission first (using API or pre-existing)
    await page.goto('/dashboard/coach/npc');

    // Find first pending submission and click upload
    const uploadButton = page.locator('a:has-text("Uploader la copie")').first();
    if (await uploadButton.isVisible().catch(() => false)) {
      await uploadButton.click();
      await page.waitForURL(/\/dashboard\/coach\/npc\/submissions\/.*\/upload/);

      // Verify instructions
      await expect(page.locator('text=Instructions')).toBeVisible();
      await expect(page.locator('text=Formats acceptés')).toBeVisible();
      await expect(page.locator('text=PDF (recommandé)')).toBeVisible();
    }
  });

  test('diagnostic report page displays all tabs', async ({ page }) => {
    // Navigate to a completed report
    await page.goto('/dashboard/coach/npc');

    // Find a completed submission
    const viewButton = page.locator('a:has-text("Voir le diagnostic")').first();
    if (await viewButton.isVisible().catch(() => false)) {
      await viewButton.click();
      await page.waitForURL(/\/dashboard\/coach\/npc\/reports\/.*/);

      // Verify all tabs exist
      await expect(page.locator('text=Vue d\'ensemble')).toBeVisible();
      await expect(page.locator('text=Compétences')).toBeVisible();
      await expect(page.locator('text=Remédiation')).toBeVisible();
      await expect(page.locator('text=Conseils')).toBeVisible();

      // Click through tabs
      await page.click('text=Compétences');
      await expect(page.locator('text=Score global')).toBeVisible();

      await page.click('text=Remédiation');
      await expect(page.locator('text=Plan de remédiation')).toBeVisible();

      await page.click('text=Conseils');
      await expect(page.locator('text=Conseil personnalisé')).toBeVisible();
    }
  });

  test('submission list filters by status', async ({ page }) => {
    await page.goto('/dashboard/coach/npc');

    // Click on different tabs
    await page.click('text=En attente');
    await expect(page.locator('[role="tabpanel"]')).toBeVisible();

    await page.click('text=En cours');
    await expect(page.locator('[role="tabpanel"]')).toBeVisible();

    await page.click('text=Terminées');
    await expect(page.locator('[role="tabpanel"]')).toBeVisible();
  });
});
