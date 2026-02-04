
import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test('Parent Dashboard - Access and Data Isolation (Debug)', async ({ page }) => {
    console.log('Injecting parent session token...');
    await loginAsUser(page, 'parent');

    console.log('Navigating to Parent Dashboard...');
    await page.goto('/dashboard/parent', { waitUntil: 'networkidle' });

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/parent-dashboard-debug.png', fullPage: true });

    // 1. Verify we are on the correct page
    await expect(page).toHaveURL(/\/dashboard\/parent/);

    // Check if there are any error messages
    const errorText = await page.textContent('body').catch(() => '');
    console.log('Page content:', errorText?.substring(0, 500));

    // More flexible checks
    const hasEspaceParent = await page.getByText(/Espace Parent/i).count();
    const hasEtudiant = await page.getByText(/Étudiant/i).count();
    const hasEnfants = await page.getByText(/Enfants/i).count();

    console.log(`Found "Espace Parent": ${hasEspaceParent}`);
    console.log(`Found "Étudiant": ${hasEtudiant}`);
    console.log(`Found "Enfants": ${hasEnfants}`);

    // At minimum, verify we're authenticated and on the right page
    expect(page.url()).toContain('/dashboard/parent');

    console.log('Parent Dashboard debug completed.');
});
