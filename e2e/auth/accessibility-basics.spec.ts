import { test, expect } from '@playwright/test';

/**
 * Accessibility Basics — E2E Tests
 *
 * Verifies fundamental accessibility requirements on key pages.
 */

const KEY_PAGES = [
  '/',
  '/offres',
  '/contact',
  '/bilan-gratuit',
  '/auth/signin',
];

test.describe('Accessibility basics', () => {
  for (const path of KEY_PAGES) {
    test(`${path} — images have alt attributes`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const images = page.locator('img');
      const count = await images.count();
      for (let i = 0; i < count; i++) {
        const alt = await images.nth(i).getAttribute('alt');
        // alt can be empty string (decorative) but must exist
        expect(alt).not.toBeNull();
      }
    });

    test(`${path} — has skip-to-content or main landmark`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const main = page.locator('main');
      const mainCount = await main.count();
      // At least one <main> landmark should exist
      expect(mainCount).toBeGreaterThanOrEqual(1);
    });

    test(`${path} — no empty links`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const emptyLinks = await page.locator('a:visible').evaluateAll((links) => links
        .slice(0, 50)
        .filter((link) => {
          const hasText = (link.textContent ?? '').trim().length > 0;
          const hasLabel = Boolean(link.getAttribute('aria-label') || link.getAttribute('title'));
          const hasSemanticChild = link.querySelector('img, svg, span') !== null;
          return !hasText && !hasLabel && !hasSemanticChild;
        })
        .map((link) => link.getAttribute('href') ?? '<sans href>'));
      expect(emptyLinks).toEqual([]);
    });
  }

  test('signin form has proper labels', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
    // Only check inputs inside <main> to avoid footer/nav inputs (e.g. newsletter)
    const inputs = page.locator('main input:visible');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const id = await inputs.nth(i).getAttribute('id');
      const ariaLabel = await inputs.nth(i).getAttribute('aria-label');
      const placeholder = await inputs.nth(i).getAttribute('placeholder');
      const name = await inputs.nth(i).getAttribute('name');
      const type = await inputs.nth(i).getAttribute('type');
      // Hidden/submit inputs don't need labels
      if (type === 'hidden' || type === 'submit') continue;
      // Input must have id (for label), aria-label, placeholder, or name
      const hasLabel = id || ariaLabel || placeholder || name;
      expect(hasLabel).toBeTruthy();
    }
  });

  test('homepage heading hierarchy is correct', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const h1Count = await page.locator('h1').count();
    // Should have at least one h1
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });
});
