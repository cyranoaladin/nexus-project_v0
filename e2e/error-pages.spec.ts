import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Error Pages — E2E Tests
 *
 * Verifies that error pages render correctly, use lux-* design,
 * don't expose sensitive info, and pass axe accessibility checks.
 */

test.describe('Error pages', () => {
  test('404 page renders for non-existent route', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(404);
  });

  test('404 page shows lux-styled content in French', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    expect(body).toContain('Page introuvable');
    expect(body).toContain('accueil');
  });

  test('404 page does not expose stack traces', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz', { waitUntil: 'domcontentloaded' });
    const body = await page.textContent('body');
    expect(body).not.toContain('Error:');
    expect(body).not.toContain('at Object.');
    expect(body).not.toContain('node_modules');
  });

  test('404 page passes axe a11y (desktop)', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('404 page passes axe a11y (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/this-page-does-not-exist-xyz', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('access-required page loads with query params', async ({ page }) => {
    const response = await page.goto('/access-required?feature=aria_maths&reason=entitlement_missing', {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).toBeLessThan(400);
  });
});
