import { expect, test } from '@playwright/test';
import { loginAs, captureConsole, disableAnimations, setupDefaultStubs } from './helpers';

test.describe('Mobile responsive', () => {
  test('Chat UI usable on iPhone viewport', async ({ page }) => {
    if (process.env.E2E === '1') {
      test.skip(true, 'Quarantined in local E2E mode to avoid viewport+login flakiness');
    }
    const cap = captureConsole(page, test.info());
    await page.setViewportSize({ width: 390, height: 844 });
    await disableAnimations(page);
    await setupDefaultStubs(page);
    await loginAs(page, 'marie.dupont@nexus.com', 'password123');
    await page.goto('/aria');
    await page.waitForLoadState('networkidle');
    const input = page.getByTestId('aria-input').first().or(page.locator('input[placeholder="Posez votre question à ARIA..."]').first());
    await expect(input).toBeVisible({ timeout: 12000 });
    await input.fill('Test sur mobile');
    const send = page.getByTestId('aria-send').first();
    await send.click().catch(async () => { await input.press('Enter'); });
    await expect(page.getByTestId('aria-messages').first()).toBeVisible();
    await cap.attach('console.mobile-responsive.json');
  });
});
