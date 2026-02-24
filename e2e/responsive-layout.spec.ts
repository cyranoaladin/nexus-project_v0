import { test, expect } from '@playwright/test';

/**
 * Responsive Layout — E2E Tests
 *
 * Verifies that key pages render correctly on mobile and desktop viewports.
 */

const MOBILE_VIEWPORT = { width: 375, height: 812 };
const TABLET_VIEWPORT = { width: 768, height: 1024 };

test.describe('Responsive layout — mobile', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('homepage renders on mobile', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 10000 });
  });

  test('offres page renders on mobile', async ({ page }) => {
    const response = await page.goto('/offres', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
  });

  test('signin page renders on mobile', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });

  test('bilan-gratuit page renders on mobile', async ({ page }) => {
    const response = await page.goto('/bilan-gratuit', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
  });

  test('no horizontal overflow on mobile homepage', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    // Allow small tolerance (5px) for scrollbar
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });
});

test.describe('Responsive layout — tablet', () => {
  test.use({ viewport: TABLET_VIEWPORT });

  test('homepage renders on tablet', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
  });

  test('contact page renders on tablet', async ({ page }) => {
    const response = await page.goto('/contact', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
  });
});
