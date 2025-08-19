import AxeBuilder from '@axe-core/playwright';
import { Page, expect } from '@playwright/test';

export async function expectNoCriticalA11yViolations(page: Page) {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const critical = (accessibilityScanResults.violations || []).filter(v => v.impact === 'critical');
  if (critical.length > 0) {
    console.log('Critical A11y violations:', JSON.stringify(critical, null, 2));
  }

  expect(critical).toEqual([]);
}
