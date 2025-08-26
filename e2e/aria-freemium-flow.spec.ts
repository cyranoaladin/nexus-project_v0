import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('ARIA Freemium Flow - Lucas Dupont', () => {
  test('shows subscription prompt after 6 questions', async ({ page }) => {
    // Intercept to simulate 429 on >= 6th request
    let count = 0;
    await page.route('**/api/aria/chat', async (route) => {
      count += 1;
      if (count >= 6) {
        return route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Limite', cta: { url: '/dashboard/parent/abonnements' } }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: `ok ${count}` }),
      });
    });

    await loginAs(page, 'lucas.dupont@nexus.com');
    await page.goto('/aria');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Assistant Pédagogique ARIA')).toBeVisible({ timeout: 20000 });
    let input = page
      .locator('[data-testid="aria-input"], input[placeholder="Posez votre question à ARIA..."]')
      .first();
    try {
      await expect(input).toBeVisible({ timeout: 12000 });
    } catch {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.getByTestId('open-aria-chat').click();
      input = page.locator('[data-testid="aria-input"], [data-testid-aria="aria-input"]').first();
      await expect(input).toBeVisible({ timeout: 12000 });
    }
    const send = page.getByTestId('aria-send');
    for (let i = 0; i < 6; i++) {
      await input.click({ timeout: 12000 });
      await input.fill(`Question ${i + 1}`);
      // Sur WebKit, cliquer le bouton peut rester disabled transitoirement => utiliser Enter
      try {
        await expect(send).toBeEnabled({ timeout: 5000 });
        await send.click();
      } catch {
        await input.press('Enter');
      }
      await page.waitForTimeout(150);
    }
    // prompt or helper message; assert on stable test id when present
    await expect(page.getByTestId('subscription-prompt')).toBeVisible({ timeout: 15000 });
  });
});
