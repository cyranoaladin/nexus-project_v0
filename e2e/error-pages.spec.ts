import { test, expect } from '@playwright/test';

/**
 * Error Pages — E2E Tests
 *
 * Verifies that error pages render correctly and don't expose sensitive info.
 */

test.describe('Error pages', () => {
  test('404 page renders for non-existent route', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(404);
  });

  test('404 page does not expose stack traces', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz', { waitUntil: 'domcontentloaded' });
    const body = await page.textContent('body');
    expect(body).not.toContain('Error:');
    expect(body).not.toContain('at Object.');
    expect(body).not.toContain('node_modules');
  });

  test('access-required page loads with query params', async ({ page }) => {
    const response = await page.goto('/access-required?feature=aria_maths&reason=entitlement_missing', {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).toBeLessThan(400);
  });
});
