import { test } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test('Generate Student State', async ({ page }) => {
    test.setTimeout(60000);
    console.log('Logging in as student...');
    await loginAsUser(page, 'student');

    console.log('Saving state...');
    await page.context().storageState({ path: 'student.json' });
    console.log('State saved.');
});

test('Generate Parent State', async ({ page }) => {
    test.setTimeout(60000);
    console.log('Logging in as parent...');
    await loginAsUser(page, 'parent');

    console.log('Saving parent state...');
    await page.context().storageState({ path: 'parent.json' });
    console.log('Parent state saved.');
});
