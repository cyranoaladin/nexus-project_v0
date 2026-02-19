
import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';
import { CREDS } from './helpers/credentials';

test('Parent Dashboard - API Test', async ({ page, context }) => {
    console.log('Logging in...');
    await loginAsUser(page, 'parent');

    console.log('Current URL:', page.url());

    // Get cookies
    const cookies = await context.cookies();
    console.log('Session cookies:', cookies.filter(c => c.name.includes('next-auth')));

    // Try API call (use request API to avoid navigation redirects)
    const response = await page.request.get('/api/parent/dashboard');
    const status = response.status();
    const body = await response.text();

    console.log('API Status:', status);
    console.log('API Response:', body);

    // Check if we can access the page
    await page.goto('/dashboard/parent', { waitUntil: 'domcontentloaded' }).catch(() => {
        // Allow redirects/interrupted navigation
    });
    if (page.url().includes('/auth/signin')) {
        await page.getByLabel('Adresse Email').fill(CREDS.parent.email);
        await page.getByRole('textbox', { name: 'Mot de Passe' }).fill(CREDS.parent.password);
        await page.getByRole('button', { name: /Accéder à Mon Espace/i }).click();
        await page.waitForURL(/\/dashboard\/parent/, { timeout: 15000 });
    }
    await page.screenshot({ path: 'test-results/parent-dashboard-api-test.png', fullPage: true });

    const pageContent = await page.textContent('body');
    console.log('Page content (first 300 chars):', pageContent?.substring(0, 300));
});
