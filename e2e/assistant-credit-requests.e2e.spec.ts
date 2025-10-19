import { expect, test } from '@playwright/test';

test.describe('E2E: Assistant Credit Requests', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/assistant/credit-requests', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          creditRequests: [
            {
              id: 'cr-1',
              amount: 10,
              description: 'Achat de 10 crédits',
              createdAt: new Date().toISOString(),
              student: { id: 'stu1', firstName: 'Marie', lastName: 'Dupont', grade: 'Terminale', school: 'Lycée' },
              parent: { firstName: 'Jean', lastName: 'Dupont', email: 'p@x.tn' }
            }
          ]
        })
      });
    });
  });

  test('shows list of credit requests', async ({ page }) => {
    await page.goto('/dashboard/assistante/credit-requests');
    await expect(page.getByText('Demandes de Crédits')).toBeVisible();
    await expect(page.getByText('Achat de 10 crédits')).toBeVisible();
  });
});

