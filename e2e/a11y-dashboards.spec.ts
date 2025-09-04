import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { disableAnimations, loginAs } from './helpers';

const dashboards = [
  { user: 'marie.dupont@nexus.com', path: '/dashboard/eleve' },
  { user: 'paul.parent@nexus.com', path: '/dashboard/parent' },
  { user: 'alice.assistante@nexus.com', path: '/dashboard/assistante' },
];

test.describe('Accessibilité (axe-core) — Dashboards', () => {
  for (const d of dashboards) {
    test(`a11y: ${d.path}`, async ({ page }) => {
      await disableAnimations(page);
      await loginAs(page, d.user);
      await page.goto(d.path, { waitUntil: 'domcontentloaded' });
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['color-contrast'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

