import { expect, test } from '@playwright/test';
import { disableAnimations, loginAs, setupDefaultStubs } from './helpers';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Admin RAG — UI minimale', () => {
  test('Accès ADMIN et présence des inputs', async ({ page }) => {
    // Nécessite une session ADMIN réelle ou bypass helpers
    await disableAnimations(page);
    await setupDefaultStubs(page);
    await loginAs(page, 'admin@nexus.com');
    await page.goto(`${BASE}/dashboard/admin/rag`, { waitUntil: 'domcontentloaded' });
    const inputs = page.locator('input[type="file"]');
    await expect(inputs.first()).toBeVisible();
  });
});

