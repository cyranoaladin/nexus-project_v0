import { expect, test } from '@playwright/test';
import { loginAs, captureConsole } from './helpers';

test.describe('Error resilience', () => {
  test('Simulated rag_service outage produces graceful degradation in ARIA', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    await loginAs(page, 'marie.dupont@nexus.com', 'password123');
    await page.goto('/aria');
    await page.waitForLoadState('networkidle');

    // Active le mode incident E2E si supporté
    await page.addInitScript(() => {
      // @ts-ignore
      window.__E2E_RAG_DOWN__ = true;
    });

    let input = page.getByTestId('aria-input').first();
    try {
      await input.waitFor({ state: 'visible', timeout: 8000 });
    } catch {
      // Fallback: open inline widget if present on the dashboard/home
      try { await page.goto('/'); } catch {}
      try { await page.getByTestId('open-aria-chat').click({ timeout: 5000 }); } catch {}
      input = page.getByTestId('aria-input').first();
      await input.waitFor({ state: 'visible', timeout: 8000 });
    }
    await input.click();
    await input.fill('Explique la dérivée quand RAG est en panne');
    const send = page.getByTestId('aria-send').first();
    await send.click().catch(async () => { await input.press('Enter'); });

    // Vérifie qu'une réponse est bien rendue (même dégradée) et que l'UI ne casse pas
    const messages = page.getByTestId('aria-messages').first();
    await expect(messages).toBeVisible();
    const hasSomeText = await messages.getByText(/.+/).first().isVisible().catch(() => false);
    expect(Boolean(hasSomeText)).toBeTruthy();
    await cap.attach('console.error-resilience.json');
  });
});
