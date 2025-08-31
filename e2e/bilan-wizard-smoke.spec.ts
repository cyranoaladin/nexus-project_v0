import { test, expect } from '@playwright/test';

// Minimal unauthenticated smoke: ensure the wizard route renders and prompts for auth
// Uses baseURL from playwright.config.ts

test('wizard unauthenticated renders wizard shell (E2E bypass)', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/bilan-gratuit/wizard`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="wizard-qcm"]')).toBeVisible({ timeout: 10000 });
});
