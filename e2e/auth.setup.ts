import { test as setup, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

const STUDENT_AUTH_FILE = 'e2e/.auth/student.json';

setup('authenticate as student', async ({ page }) => {
  page.on('console', msg => console.log(`[Browser]: ${msg.text()}`));

  await loginAsUser(page, 'student');

  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((cookie) => cookie.name.includes('session-token'));
  expect(sessionCookie).toBeTruthy();

  await expect(page.getByText(/solde de crédits/i)).toBeVisible({ timeout: 15000 });

  await expect(page).toHaveURL(/\/dashboard\/(eleve|student)/);

  await page.context().storageState({ path: STUDENT_AUTH_FILE });
});
