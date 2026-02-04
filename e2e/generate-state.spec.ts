import { test } from '@playwright/test';

test.skip('Generate Student State', async ({ page }) => {
    test.setTimeout(60000);
    console.log('Navigating to signin...');
    await page.goto('/auth/signin?callbackUrl=/dashboard/student', { waitUntil: 'networkidle' });

    console.log('Filling email...');
    await page.fill('#email', 'student@example.com');

    console.log('Filling password...');
    await page.fill('#password', 'admin123');

    console.log('Clicking submit...');
    await page.click('button[type="submit"]');

    console.log('Waiting for dashboard...');
    // Adjust regex to match either /dashboard/eleve or /student or the redirect target
    await page.waitForURL(/(\/dashboard|\/student)/, { timeout: 30000 });
    await page.waitForLoadState('networkidle');

    console.log('Saving state...');
    await page.context().storageState({ path: 'student.json' });
    console.log('State saved.');
});

test('Generate Parent State', async ({ page }) => {
    test.setTimeout(60000);
    console.log('Navigating to signin...');
    await page.goto('/auth/signin?callbackUrl=/dashboard/parent', { waitUntil: 'networkidle' });

    console.log('Filling email...');
    await page.fill('#email', 'parent@example.com');

    console.log('Filling password...');
    await page.fill('#password', 'admin123');

    console.log('Clicking submit...');
    await page.click('button[type="submit"]');

    console.log('Waiting for dashboard...');
    await page.waitForURL(/\/dashboard\/parent/, { timeout: 60000 });
    await page.waitForLoadState('networkidle');

    // Wait a bit more to ensure session cookie is fully set
    await page.waitForTimeout(2000);

    console.log('Saving parent state...');
    await page.context().storageState({ path: 'parent.json' });
    console.log('Parent state saved.');
});
