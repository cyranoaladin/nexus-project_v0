import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAs } from './helpers';

test.setTimeout(180000);

test('a11y: ARIA page has no serious/critical violations', async ({ page }) => {
  await loginAs(page, 'marie.dupont@nexus.com', 'password123');
  await page.goto('/aria');
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const violations = accessibilityScanResults.violations.filter((v) =>
    ['serious', 'critical'].includes(v.impact || '')
  );
  expect(violations, JSON.stringify(violations, null, 2)).toHaveLength(0);
});
