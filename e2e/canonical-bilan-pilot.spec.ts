import { expect, test } from '@playwright/test';

import { loginAsUser } from './helpers/auth';

test.describe('Canonical bilan pilot surfaces with flags off', () => {
  test('student sees the fail-closed start state while no pack is activated', async ({ page }) => {
    await loginAsUser(page, 'student');
    await page.goto('/bilan-gratuit/assessment');
    await expect(page.getByRole('heading', { name: 'Commencer mon questionnaire' })).toBeVisible();
    await expect(page.getByText('Aucun questionnaire n’est ouvert actuellement.')).toBeVisible();
  });

  test('parent receives a restrained denial for an unknown report', async ({ page }) => {
    await loginAsUser(page, 'parent');
    const childrenResponse = await page.request.get('/api/parent/children');
    expect(childrenResponse.status()).toBe(200);
    const children = await childrenResponse.json() as Array<{ id: string }>;
    expect(children.length).toBeGreaterThan(0);

    const reportResponse = await page.request.get(
      `/api/parent/children/${children[0].id}/bilans/attempt-inexistant/report?format=html`,
      { failOnStatusCode: false },
    );
    expect(reportResponse.status()).toBe(404);
    expect(reportResponse.headers()['cache-control']).toContain('no-store');
    expect(await reportResponse.json()).toEqual({ error: { code: 'NOT_FOUND' } });
  });
});
