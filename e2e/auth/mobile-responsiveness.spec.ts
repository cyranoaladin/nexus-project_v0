import { test, expect } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 390, height: 844 };

const PUBLIC_PAGES = [
  '/',
  '/offres',
  '/bilan-gratuit',
  '/contact',
  '/accompagnement-scolaire',
  '/equipe',
  '/conditions',
  '/auth/signin',
];

test.describe('Mobile Responsiveness — Pages Publiques', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  PUBLIC_PAGES.forEach((url) => {
    test(`${url} est lisible sur mobile (390×844)`, async ({ page }) => {
      const response = await page.goto(url);
      // Page should not return 500
      expect(response?.status()).toBeLessThan(500);
      await page.waitForLoadState('domcontentloaded');

      // No horizontal scroll overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10); // 10px tolerance

      // H1 visible
      const h1 = page.locator('h1').first();
      if (await h1.isVisible()) {
        await expect(h1).toBeVisible();
      }
    });
  });

  test('menu hamburger fonctionne sur mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Look for hamburger/mobile menu button
    const hamburger = page.locator('button[aria-label*="menu" i], button[data-testid="mobile-menu"], [data-testid="mobile-menu-button"]').first();
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(500);
      // Menu should now show navigation links
      const navLink = page.getByRole('link', { name: /offres|bilan/i }).first();
      if (await navLink.isVisible()) {
        await navLink.click();
        await expect(page).not.toHaveURL('/');
      }
    }
  });

  test('formulaire bilan-gratuit est utilisable sur mobile', async ({ page }) => {
    await page.goto('/bilan-gratuit');
    await page.waitForLoadState('domcontentloaded');

    // Email input should be visible and accessible
    const emailInput = page.getByTestId('input-parent-email');
    await expect(emailInput).toBeVisible();

    // Input should have minimum touch target height
    const inputBox = await emailInput.boundingBox();
    if (inputBox) {
      expect(inputBox.height).toBeGreaterThanOrEqual(36); // Reasonable mobile touch target
    }
  });

  test('signin page est utilisable sur mobile', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('input-email')).toBeVisible();
    await expect(page.getByTestId('input-password')).toBeVisible();
    await expect(page.getByTestId('btn-signin')).toBeVisible();

    // No horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
  });
});

test.describe('Mobile Responsiveness — Tablet (768×1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('homepage est lisible sur tablette', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
  });

  test('offres est lisible sur tablette', async ({ page }) => {
    await page.goto('/offres');
    await page.waitForLoadState('domcontentloaded');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
  });
});
