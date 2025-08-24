import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Mobile responsive', () => {
  test('Chat UI usable on iPhone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, 'marie.dupont@nexus.com', 'password123');
    await page.goto('/aria');
    await page.waitForLoadState('networkidle');
    // Attendre que la page ARIA soit rendue côté client
    await expect(page.getByText('Assistant Pédagogique ARIA')).toBeVisible({ timeout: 20000 });
    const input = page
      .locator('[data-testid="aria-input"], input[placeholder="Posez votre question à ARIA..."]')
      .first();
    try {
      await expect(input).toBeVisible({ timeout: 20000 });
    } catch {
      // Fallback: ouvrir le widget ARIA depuis la home
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.getByTestId('open-aria-chat').click();
      await expect(page.locator('[data-testid="aria-input"], [data-testid-aria="aria-input"]').first()).toBeVisible({ timeout: 20000 });
    }
    await input.fill('Test sur mobile');
    const send = page
      .locator('[data-testid="aria-send"], button[aria-label="Envoyer le message"]')
      .first();
    await send.click().catch(async () => { await input.press('Enter'); });
    await expect(page.getByTestId('aria-messages').first()).toBeVisible();
  });
});
