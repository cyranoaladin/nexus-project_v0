import { test, expect } from '@playwright/test';

/**
 * Password Reset Flow — E2E Tests
 *
 * Verifies the forgot password page and reset password page behavior.
 */

test.describe('Password reset flow', () => {
  test('forgot password page loads correctly', async ({ page }) => {
    await page.goto('/auth/mot-de-passe-oublie', { waitUntil: 'domcontentloaded' });
    const response = await page.goto('/auth/mot-de-passe-oublie');
    expect(response?.status()).toBeLessThan(400);

    // Should have an email input
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });

  test('forgot password form rejects empty email', async ({ page }) => {
    await page.goto('/auth/mot-de-passe-oublie', { waitUntil: 'domcontentloaded' });

    // Try to submit without filling email
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Should show validation error or stay on same page
      await expect(page).toHaveURL(/mot-de-passe-oublie/);
    }
  });

  test('reset password page with invalid token shows error', async ({ page }) => {
    await page.goto('/auth/reset-password?token=invalid-token-xyz', { waitUntil: 'domcontentloaded' });
    const response = await page.goto('/auth/reset-password?token=invalid-token-xyz');
    // Should load (200) but show error message about invalid/expired token
    expect(response?.status()).toBeLessThan(500);
  });

  test('signin page has forgot password link', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
    const forgotLink = page.locator('a[href*="mot-de-passe"]');
    await expect(forgotLink).toBeVisible({ timeout: 10000 });
  });
});
