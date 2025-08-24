import { Page, expect } from '@playwright/test';

export async function loginAs(page: Page, email: string, password?: string) {
  // Utiliser un goto plus tolérant pour éviter les aborts sur Firefox
  try {
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
  } catch {}

  // Attendre que la page de connexion soit prête
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 20000 });

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password || 'password123');

  // Cliquer et attendre une navigation ou une stabilisation minimale du DOM
  await page.locator('button[type="submit"]').click();
  try {
    await Promise.race([
      page.waitForURL('**/dashboard/**', { timeout: 20000 }),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 })
    ]);
  } catch {}
  // Laisser le routeur Next stabiliser son état
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(200);
}
