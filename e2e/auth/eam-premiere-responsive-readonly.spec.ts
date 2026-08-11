import { expect, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

const viewports = [
  { name: 'mini laptop', width: 1024, height: 600 },
  { name: 'petit laptop', width: 1280, height: 720 },
  { name: 'tablette', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe('EAM Première 2026 — état post-campagne', () => {
  test('le module expiré reste masqué et les routes restent stables à tous les viewports', async ({ page }) => {
    await loginAsUser(page, 'student');

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const dashboard = await page.goto('/dashboard/eleve', { waitUntil: 'domcontentloaded' });
      expect(dashboard?.status(), viewport.name).toBe(200);
      await expect(page.getByRole('region', {
        name: /préparation épreuve anticipée de mathématiques/i,
      })).toHaveCount(0);
      await expectNoHorizontalOverflow(page);

      const legacyModule = await page.goto('/dashboard/eleve/eam', { waitUntil: 'domcontentloaded' });
      expect(legacyModule?.status(), viewport.name).toBe(200);
      await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i);
      await expectNoHorizontalOverflow(page);
    }
  });
});
