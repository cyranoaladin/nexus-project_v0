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
      const links = page.locator('a:visible');
      const count = await links.count();
      for (let i = 0; i < Math.min(count, 50); i++) {
        const text = await links.nth(i).innerText();
        const ariaLabel = await links.nth(i).getAttribute('aria-label');
        const title = await links.nth(i).getAttribute('title');
        const hasChild = await links.nth(i).locator('img, svg, span').count();
        // Link must have text, aria-label, title, or child element
        const hasContent = text.trim().length > 0 || ariaLabel || title || hasChild > 0;
        expect(hasContent).toBeTruthy();
      }
    });
  }

  test('signin form has proper labels', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
    const inputs = page.locator('input:visible');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const id = await inputs.nth(i).getAttribute('id');
      const ariaLabel = await inputs.nth(i).getAttribute('aria-label');
      const placeholder = await inputs.nth(i).getAttribute('placeholder');
      const type = await inputs.nth(i).getAttribute('type');
      // Hidden/submit inputs don't need labels
      if (type === 'hidden' || type === 'submit') continue;
      // Input must have id (for label), aria-label, or placeholder
      const hasLabel = id || ariaLabel || placeholder;
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
