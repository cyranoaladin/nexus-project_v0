import { expect, test } from '@playwright/test';

test.describe('E2E: Assistante Bilans', () => {
  test('generates bilan content via mocked API', async ({ page }) => {
    await page.route('**/api/bilan-gratuit/generate', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, content: 'Bilan généré (mock)' })
      });
    });

    await page.goto('/dashboard/assistante/bilans');
    await page.getByPlaceholder('Terminale').fill('Terminale');
    await page.getByPlaceholder("Nom de l'élève").fill('Marie Dupont');
    await page.getByPlaceholder('Informations issues du bilan gratuit').fill('Contexte test');
    await page.getByRole('button', { name: 'Générer' }).click();
    await expect(page.getByText('Bilan généré (mock)')).toBeVisible();
  });
});

