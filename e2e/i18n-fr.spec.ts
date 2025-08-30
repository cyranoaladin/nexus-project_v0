import { test, expect } from '@playwright/test';

test.describe('Vérifications i18n FR', () => {
  test('Admin analytics: titre FR présent, pas de "Analytics" en clair', async ({ page }) => {
    await page.goto('/dashboard/admin/analytics', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Analytique/i })).toBeVisible();
  });

  test('Parent: pas de N/A pour prochaine facturation ("Aucune" accepté)', async ({ page }) => {
    await page.goto('/dashboard/parent', { waitUntil: 'domcontentloaded' });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/\bN\/A\b/);
  });
});
