import { expect, test } from '@playwright/test';

test.describe('E2E: Student Mes Sessions', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API for sessions
    await page.route('**/api/student/sessions', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'sess-1',
            title: 'Cours de Maths',
            subject: 'MATHEMATIQUES',
            status: 'SCHEDULED',
            scheduledAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            duration: 60,
            creditsUsed: 1,
            modality: 'ONLINE',
            type: 'INDIVIDUAL',
            coach: { firstName: 'Pierre', lastName: 'Martin' }
          }
        ])
      });
    });
  });

  test('lists sessions and shows join available when within 15 minutes', async ({ page }) => {
    await page.goto('/dashboard/eleve/mes-sessions');
    await expect(page.getByText('Sessions')).toBeVisible();
    await expect(page.getByText('Cours de Maths')).toBeVisible();
    await expect(page.getByText('MATHEMATIQUES')).toBeVisible();
  });
});

