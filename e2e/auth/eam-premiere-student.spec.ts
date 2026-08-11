import { expect, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

test.describe('EAM Première 2026 — expiration fonctionnelle', () => {
  test('un élève Première ne peut plus démarrer ni muter la campagne expirée', async ({ page }) => {
    await loginAsUser(page, 'student');
    await page.goto('/dashboard/eleve', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('region', {
      name: /préparation épreuve anticipée de mathématiques/i,
    })).toHaveCount(0);

    const before = await page.request.get('/api/eam/progress', { failOnStatusCode: false });
    expect(before.status()).toBe(200);

    await page.goto('/dashboard/eleve/eam', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#eam-prep')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i);

    const after = await page.request.get('/api/eam/progress', { failOnStatusCode: false });
    expect(after.status()).toBe(200);
    expect(await after.json()).toEqual(await before.json());
  });
});
