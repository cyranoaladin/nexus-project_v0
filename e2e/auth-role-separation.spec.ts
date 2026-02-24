import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test.describe('Auth Role Separation — Parent vs Élève', () => {
  test('parent credentials cannot access /dashboard/eleve', async ({ page }) => {
    await loginAsUser(page, 'parent', { navigate: false });
    await page.goto('/dashboard/eleve');
    await page.waitForLoadState('domcontentloaded');
    // Should be redirected away from eleve dashboard
    const url = page.url();
    expect(url).not.toContain('/dashboard/eleve');
  });

  test('student credentials cannot access /dashboard/parent', async ({ page }) => {
    await loginAsUser(page, 'student', { navigate: false });
    await page.goto('/dashboard/parent');
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    expect(url).not.toContain('/dashboard/parent');
  });

  test('student credentials cannot access /dashboard/admin', async ({ page }) => {
    await loginAsUser(page, 'student', { navigate: false });
    await page.goto('/dashboard/admin');
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    expect(url).not.toContain('/dashboard/admin');
  });

  test('parent credentials cannot access /dashboard/admin', async ({ page }) => {
    await loginAsUser(page, 'parent', { navigate: false });
    await page.goto('/dashboard/admin');
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    expect(url).not.toContain('/dashboard/admin');
  });

  test('coach credentials cannot access /dashboard/parent', async ({ page }) => {
    await loginAsUser(page, 'coach', { navigate: false });
    await page.goto('/dashboard/parent');
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    expect(url).not.toContain('/dashboard/parent');
  });

  test('unauthenticated user is redirected from /dashboard/parent', async ({ page }) => {
    await page.goto('/dashboard/parent');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/auth\/signin/);
  });

  test('unauthenticated user is redirected from /dashboard/admin', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/auth\/signin/);
  });

  test('signin page shows helper text distinguishing parent vs eleve', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/parent/i).first()).toBeVisible();
    await expect(page.getByText(/élève/i).first()).toBeVisible();
  });
});
