import { test as setup, expect } from '@playwright/test';

const STUDENT_AUTH_FILE = 'e2e/.auth/student.json';

setup('authenticate as student', async ({ page }) => {
  page.on('console', msg => console.log(`[Browser]: ${msg.text()}`));
  await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });

  await page.getByLabel(/email/i).fill('yasmine.dupont@test.com');
  await page.getByPlaceholder('Votre mot de passe').fill('password123');

  await Promise.all([
    page.waitForURL(/\/dashboard\/.+/, { timeout: 10000 }),
    page.getByRole('button', { name: /accéder|sign in|connexion/i }).click(),
  ]);

  await expect(page.getByText(/solde de crédits/i)).toBeVisible({ timeout: 15000 });

  await expect(page).toHaveURL(/\/dashboard\/(eleve|student)/);

  await page.context().storageState({ path: STUDENT_AUTH_FILE });
});
