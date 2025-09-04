import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { disableAnimations } from './helpers';

test.describe('Accessibilité (axe-core) — Wizard Bilan', () => {
  test('a11y: wizard en mode e2e bypass (step 2)', async ({ page }) => {
    await disableAnimations(page);
    await page.request.post(`/api/test/login`, { data: { role: 'ELEVE' } });
    await page.goto(`/bilan-gratuit/wizard?e2e=1&step=2`, { waitUntil: 'domcontentloaded' });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

