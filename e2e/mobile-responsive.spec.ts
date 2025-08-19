import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Mobile responsive', () => {
  test('Chat UI usable on iPhone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, 'marie.dupont@nexus.com', 'password123');
    await page.goto('/aria');
    await page.waitForLoadState('networkidle');
    const input = page.getByTestId('aria-input').first();
    await expect(input).toBeVisible();
    await input.fill('Test sur mobile');
    const send = page.getByTestId('aria-send').first();
    await send.click().catch(async () => { await input.press('Enter'); });
    await expect(page.getByTestId('aria-messages').first()).toBeVisible();
  });
});
