import { Page, expect } from '@playwright/test';

export async function loginAs(page: Page, email: string, password?: string) {
  // Aller à la page de connexion
  try {
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
  } catch {}

  // Attendre que la page de connexion soit prête (sélecteurs robustes)
  await expect(page.getByLabel('Adresse Email')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('input#email')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('input#password')).toBeVisible({ timeout: 20000 });

  // Renseigner les identifiants
  await page.locator('input#email').fill(email);
  await page.locator('input#password').fill(password || 'password123');

  // Soumettre et attendre l'authentification effective côté client (cookie NextAuth)
  await page.locator('button[type="submit"]').click();

  // Attendre que /api/auth/session renvoie un utilisateur (garantit la présence de la session)
  await page.waitForFunction(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return false;
      const json = await res.json();
      return Boolean(json?.user?.email);
    } catch {
      return false;
    }
  }, { timeout: 20000 });

  // Stabiliser
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(200);
}
