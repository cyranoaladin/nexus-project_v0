
import { test } from '@playwright/test';

test('Parent Dashboard - API Test', async ({ page, context }) => {
    console.log('Logging in...');
    await page.goto('/auth/signin');
    await page.fill('#email', 'parent@example.com');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    console.log('Current URL:', page.url());

    // Get cookies
    const cookies = await context.cookies();
    console.log('Session cookies:', cookies.filter(c => c.name.includes('next-auth')));

    // Try API call
    const response = await page.goto('/api/parent/dashboard');
    const status = response?.status();
    const body = await response?.text();

    console.log('API Status:', status);
    console.log('API Response:', body);

    // Check if we can access the page
    await page.goto('/dashboard/parent');
    await page.screenshot({ path: 'test-results/parent-dashboard-api-test.png', fullPage: true });

    const pageContent = await page.textContent('body');
    console.log('Page content (first 300 chars):', pageContent?.substring(0, 300));
});
