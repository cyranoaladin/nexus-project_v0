import { expect, test } from '@playwright/test';
import { captureConsole } from './helpers';
const RUN = process.env.E2E_RUN === '1';
(RUN ? test.describe : test.describe.skip)('Subscriptions and ARIA+', () => {
  test('ARIA chat widget present on dashboard', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    try {
      await page.goto('/');
      // Use a more specific selector to avoid strict-mode ambiguity
      await expect(page.getByRole('heading', { name: /IA ARIA/i })).toBeVisible();
    } finally {
      await cap.attach('console.subscriptions.aria.json');
    }
  });
});
