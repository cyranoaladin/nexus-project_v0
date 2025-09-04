import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { disableAnimations, loginAs } from './helpers';

test.describe('ARIA - Accessibilité (axe-core)', () => {
  test('analyse a11y de la page/du widget ARIA', async ({ page }) => {
    await disableAnimations(page);
    await loginAs(page, 'marie.dupont@nexus.com');
    await page.goto('/aria', { waitUntil: 'domcontentloaded' }).catch(() => null);
    // Ouvrir le widget si nécessaire
    const openBtn = page.getByTestId('open-aria-chat');
    if (await openBtn.isVisible().catch(() => false)) {
      await openBtn.click();
    }
    // S’assurer que l’input ARIA est visible
    const input = page.locator('[data-testid="aria-input"], [data-testid-aria="aria-input"], input[placeholder="Posez votre question à ARIA..."]').first();
    await expect(input).toBeVisible({ timeout: 12000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
