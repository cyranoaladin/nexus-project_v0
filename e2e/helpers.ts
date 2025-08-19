import { Page, expect } from '@playwright/test';

export async function loginAs(page: Page, email: string, password?: string) {
  await page.goto('/auth/signin');

  // Attendre que la page de connexion soit prête
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 20000 });

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password || 'password123');

  // Cliquer et tenter d'attendre la redirection; en cas de timeout, forcer la navigation
  await page.locator('button[type="submit"]').click();
  try {
    await page.waitForURL('**/dashboard/**', { timeout: 20000 });
  } catch {
    // En mode E2E, ne forcez pas de navigation supplémentaire
  }
}
