import { test, expect } from '@playwright/test';

/**
 * Signin Form — E2E Tests
 *
 * Verifies the signin form UI behavior and validation.
 */

test.describe('Signin form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
  });

  test('renders email and password inputs', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
  });

  test('renders submit button', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible({ timeout: 10000 });
  });

  test('shows error for invalid credentials', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await emailInput.fill('invalid@test.com');
    await passwordInput.fill('wrongpassword');
    await submitBtn.click();

    // Should stay on signin page or show error
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('signin');
  });

  test('password input masks characters', async ({ page }) => {
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const type = await passwordInput.getAttribute('type');
    expect(type).toBe('password');
  });

  test('has link to forgot password', async ({ page }) => {
    const forgotLink = page.locator('a[href*="mot-de-passe"]');
    await expect(forgotLink).toBeVisible({ timeout: 10000 });
  });
});
