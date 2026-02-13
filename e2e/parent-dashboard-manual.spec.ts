
import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test('Parent Dashboard - Manual Login Flow', async ({ page }) => {
  console.log('Logging in via API session...');
  await loginAsUser(page, 'parent');

    console.log('Current URL:', page.url());

    // Navigate to parent dashboard
    await page.goto('/dashboard/parent', { waitUntil: 'domcontentloaded' }).catch(() => {
      // Allow redirects/interrupted navigations
    });

    // If redirected to signin, perform UI login fallback
    if (page.url().includes('/auth/signin')) {
      await page.getByLabel(/Adresse Email/i).fill('parent.dashboard@test.com');
      await page.getByRole('textbox', { name: 'Mot de Passe' }).fill('password123');
      await page.getByRole('button', { name: /Accéder à Mon Espace/i }).click();
      await expect(
        page.getByText(/Tableau de Bord|Espace Parent|Marie Dupont/i).first()
      ).toBeVisible({ timeout: 15000 });
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/parent-dashboard-manual-login.png', fullPage: true });

    // Wait for main dashboard signal
    await expect(
      page.getByText(/Tableau de Bord|Espace Parent|Marie Dupont/i).first()
    ).toBeVisible({ timeout: 15000 });

    // Check page content (debug)
    const bodyText = await page.textContent('body');
    console.log('Page content (first 500 chars):', bodyText?.substring(0, 500));

    // Verify we're on the right page
    await expect(page).toHaveURL(/\/dashboard\/parent/);

    // Check for error or success
    const hasError = await page.getByText(/Erreur/i).count();
    console.log(`Has Error: ${hasError}`);
    expect(hasError).toBe(0);

    console.log('Manual login test completed successfully.');
});
