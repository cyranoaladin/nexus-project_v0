import { test as setup, expect } from '@playwright/test';

const STUDENT_AUTH_FILE = 'e2e/.auth/student.json';

setup('authenticate as student', async ({ page }) => {
  await page.goto('/auth/signin', { waitUntil: 'networkidle' });

  await page.getByLabel(/email/i).fill('student@test.com');
  await page.getByLabel(/password/i).fill('password123');

  await Promise.all([
    page.waitForURL(/\/dashboard\/.+/, { timeout: 10000 }),
    page.getByRole('button', { name: /sign in|connexion|se connecter/i }).click(),
  ]);

  await page.waitForLoadState('networkidle');

  await expect(page).toHaveURL(/\/dashboard\/(eleve|student)/);

  await page.context().storageState({ path: STUDENT_AUTH_FILE });
});
