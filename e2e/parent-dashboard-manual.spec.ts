
import { test, expect } from '@playwright/test';

test('Parent Dashboard - Manual Login Flow', async ({ page }) => {
    console.log('Navigating to signin page...');
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });

    // Fill credentials
    await page.getByLabel(/email/i).fill('parent.dashboard@test.com');
    await page.getByPlaceholder('Votre mot de passe').fill('password123');

    // Submit
    await page.getByRole('button', { name: /accéder|sign in|connexion/i }).click();

    // Wait for redirect
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    console.log('Current URL:', page.url());

    // Navigate to parent dashboard
    await page.goto('/dashboard/parent', { waitUntil: 'networkidle' });

    // Take screenshot
    await page.screenshot({ path: 'test-results/parent-dashboard-manual-login.png', fullPage: true });

    // Check page content
    const bodyText = await page.textContent('body');
    console.log('Page content (first 500 chars):', bodyText?.substring(0, 500));

    // Verify we're on the right page
    await expect(page).toHaveURL(/\/dashboard\/parent/);

    // Check for error or success
    const hasError = await page.getByText(/Erreur/i).count();
    const hasEspaceParent = await page.getByText(/Espace Parent/i).count();

    console.log(`Has Error: ${hasError}`);
    console.log(`Has Espace Parent: ${hasEspaceParent}`);

    expect(hasError).toBe(0);
    // Dashboard may show 'Tableau de Bord Parental' instead of 'Espace Parent'
    const hasDashboard = await page.getByText(/Tableau de Bord|Espace Parent/i).count();
    expect(hasEspaceParent + hasDashboard).toBeGreaterThan(0);

    console.log('Manual login test completed successfully.');
});
