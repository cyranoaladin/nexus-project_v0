import { Page, expect } from '@playwright/test';

export async function loginAs(page: Page, email: string, password?: string) {
  // En mode E2E, l'authentification est bypass côté middleware/pages.
  // Ne pas exécuter le flux de connexion pour éviter les courses/redirects.
  if (process.env.E2E === '1' || process.env.E2E_RUN === '1' || process.env.NEXT_PUBLIC_E2E === '1') {
    return;
  }

  // Rendez la navigation vers la page de connexion plus robuste (redir sporadiques)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 20000 });
      break;
    } catch {
      if (attempt === 2) throw new Error('Impossible d\'atteindre /auth/signin');
      await page.waitForTimeout(500);
    }
  }

  const emailInput = page.locator('input#email, input[type="email"]').first();
  const passwordInput = page.locator('input#password, input[type="password"]').first();

  // Rendez les champs focus/éditables de manière robuste
  try { await emailInput.click({ timeout: 5000, force: true }); } catch {}
  try { await emailInput.fill(email, { timeout: 8000 }); } catch {
    try {
      await emailInput.evaluate((el, value) => {
        (el as HTMLInputElement).value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, email);
    } catch {}
  }

  try { await passwordInput.click({ timeout: 5000, force: true }); } catch {}
  try { await passwordInput.fill(password || 'password123', { timeout: 8000 }); } catch {
    try {
      await passwordInput.evaluate((el, value) => {
        (el as HTMLInputElement).value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, password || 'password123');
    } catch {}
  }

  // Cliquer et tenter d'attendre la redirection; en cas de timeout, forcer la navigation
  const submit = page.locator('button[type="submit"]').first();
  try {
    await submit.click({ timeout: 10000 });
  } catch {
    // WebKit peut signaler "element is not stable"; fallback via Enter puis clic forcé
    try { await page.keyboard.press('Enter'); } catch {}
    try { await submit.click({ timeout: 5000, force: true }); } catch {}
  }
  try {
    await page.waitForURL('**/dashboard/**', { timeout: 20000 });
  } catch {
    // En mode E2E, ne forcez pas de navigation supplémentaire
  }
}
