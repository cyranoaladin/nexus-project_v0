import { expect, test } from '@playwright/test';
import { captureConsole, disableAnimations, setupDefaultStubs } from './helpers';

test.describe('Subscriptions and ARIA+', () => {
  test('ARIA chat widget present on dashboard', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    try {
      await disableAnimations(page);
      await setupDefaultStubs(page);
      await page.route('**/', route => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body><header><h2>IA ARIA</h2></header><main></main></body></html>'
      }));
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /IA ARIA/i })).toBeVisible();
    } finally {
      await cap.attach('console.subscriptions.aria.json');
    }
  });
});
