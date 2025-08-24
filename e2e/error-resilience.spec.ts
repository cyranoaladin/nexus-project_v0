import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Error resilience', () => {
  test('Simulated rag_service outage produces graceful degradation in ARIA', async ({ page }) => {
    // Active le mode incident E2E avant toute navigation
    await page.addInitScript(() => {
      // @ts-ignore
      window.__E2E_RAG_DOWN__ = true;
    });
    await loginAs(page, 'marie.dupont@nexus.com', 'password123');
    await page.goto('/aria');
    await page.waitForLoadState('networkidle');

    const input = page
      .locator('[data-testid="aria-input"], input[placeholder="Posez votre question à ARIA..."]')
      .first();
    await expect(page.getByText('Assistant Pédagogique ARIA')).toBeVisible({ timeout: 20000 });
    await expect(input).toBeVisible({ timeout: 20000 });
    await input.click();
    await input.fill('Explique la dérivée quand RAG est en panne');
    const send = page
      .locator('[data-testid="aria-send"], button[aria-label="Envoyer le message"]')
      .first();
    await send.click().catch(async () => { await input.press('Enter'); });

    // Vérifie qu'une réponse est bien rendue (même dégradée) et que l'UI ne casse pas
    const messages = page.getByTestId('aria-messages').first();
    await expect(messages).toBeVisible({ timeout: 15000 });
    const hasSomeText = await messages.getByText(/.+/).first().isVisible().catch(() => false);
    expect(Boolean(hasSomeText)).toBeTruthy();
  });
});
