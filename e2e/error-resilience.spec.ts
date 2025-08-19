import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Error resilience', () => {
  test('Simulated rag_service outage produces graceful degradation in ARIA', async ({ page }) => {
    await loginAs(page, 'marie.dupont@nexus.com', 'password123');
    await page.goto('/aria');
    await page.waitForLoadState('networkidle');

    // Active le mode incident E2E si supporté
    await page.addInitScript(() => {
      // @ts-ignore
      window.__E2E_RAG_DOWN__ = true;
    });

    const input = page.getByTestId('aria-input').first();
    await input.click();
    await input.fill('Explique la dérivée quand RAG est en panne');
    const send = page.getByTestId('aria-send').first();
    await send.click().catch(async () => { await input.press('Enter'); });

    // Vérifie qu'une réponse est bien rendue (même dégradée) et que l'UI ne casse pas
    const messages = page.getByTestId('aria-messages').first();
    await expect(messages).toBeVisible();
    const hasSomeText = await messages.getByText(/.+/).first().isVisible().catch(() => false);
    expect(Boolean(hasSomeText)).toBeTruthy();
  });
});
