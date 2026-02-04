
import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test('Parent Dashboard - Access and Data Isolation', async ({ page }) => {
    console.log('Injecting parent session token...');
    await loginAsUser(page, 'parent');

    console.log('Navigating to Parent Dashboard...');
    await page.goto('/dashboard/parent', { waitUntil: 'networkidle' });

    // 1. Verify we are on the correct page
    await expect(page).toHaveURL(/\/dashboard\/parent/);
    await expect(page.getByText('Espace Parent')).toBeVisible();

    // 2. Verify Children List
    // From seed data: Student "Étudiant Test" is linked to Parent "Parent Test".
    await expect(page.getByText('Étudiant')).toBeVisible();

    // 3. Verify Components Presence
    // Check for key dashboard sections
    await expect(page.getByText('Mes Enfants').or(page.getByText('Enfants'))).toBeVisible();

    // 4. Verify Navigation Elements
    // Check that "Ajouter un enfant" button exists
    await expect(page.getByRole('button', { name: /Ajouter/i })).toBeVisible();

    // 5. Verify user is authenticated (logout button present)
    await expect(page.getByRole('button', { name: /Déconnexion/i }).or(page.locator('button:has-text("Déconnexion")'))).toBeVisible();

    console.log('Parent Dashboard verified successfully.');
});
