// ═══════════════════════════════════════════════════════════════════════════════
// E2E Tests: NPC Student View
// Student can view their own diagnostics
// ═══════════════════════════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('NPC Student View', () => {
  test.beforeEach(async ({ page }) => {
    // Login as student
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'student@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/eleve');
  });

  test('student can navigate to diagnostics page', async ({ page }) => {
    // Click on Mes Diagnostics in navigation
    await page.click('text=Mes Diagnostics');
    await page.waitForURL('/dashboard/eleve/npc');

    // Verify page elements
    await expect(page.locator('h1')).toContainText('Mes Diagnostics');
    await expect(page.locator('text=Consultez les analyses')).toBeVisible();
  });

  test('student sees their diagnostic stats', async ({ page }) => {
    await page.goto('/dashboard/eleve/npc');

    // Verify stat cards exist
    await expect(page.locator('text=Diagnostics reçus')).toBeVisible();
    await expect(page.locator('text=Matières couvertes')).toBeVisible();
    await expect(page.locator('text=En cours')).toBeVisible();
  });

  test('student can switch between tabs', async ({ page }) => {
    await page.goto('/dashboard/eleve/npc');

    // Switch to pending tab
    await page.click('text=En cours');
    await expect(page.locator('[role="tabpanel"]')).toBeVisible();

    // Switch back to reports
    await page.click('text=Mes diagnostics');
    await expect(page.locator('[role="tabpanel"]')).toBeVisible();
  });

  test('student can view a completed diagnostic', async ({ page }) => {
    await page.goto('/dashboard/eleve/npc');

    // Find and click on a diagnostic
    const viewButton = page.locator('a:has-text("Voir mon diagnostic")').first();
    if (await viewButton.isVisible().catch(() => false)) {
      await viewButton.click();
      await page.waitForURL(/\/dashboard\/eleve\/npc\/reports\/.*/);

      // Verify report page
      await expect(page.locator('text=Diagnostic Pédagogique')).toBeVisible();
    }
  });

  test('student cannot access coach pages', async ({ page }) => {
    // Try to access coach dashboard
    await page.goto('/dashboard/coach/npc');

    // Should be redirected to login or dashboard
    await expect(page).toHaveURL(/\/dashboard\/eleve|\/auth\/login/);
  });
});
