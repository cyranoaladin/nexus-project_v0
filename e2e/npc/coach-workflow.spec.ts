import { expect, test } from '@playwright/test';

import { loginAsUser } from '../helpers/auth';

test.describe.serial('NPC Coach Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'coach');
  });

  test('coach can navigate to NPC dashboard', async ({ page }) => {
    await page.getByText('Pédagogie', { exact: true }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/coach\/npc$/);
    await expect(page.getByRole('heading', { name: 'Nexus Pédagogie' })).toBeVisible();
    await expect(page.getByText(/Gérez les copies/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nouvelle copie' })).toBeVisible();
  });

  test('coach can create a new submission and reaches its upload page', async ({ page }) => {
    await page.goto('/dashboard/coach/npc');
    await page.getByRole('button', { name: 'Nouvelle copie' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('button[role="combobox"]').first()).toContainText('Yasmine Dupont');
    await dialog.getByPlaceholder('Ex: DS Maths - Fonctions dérivées').fill('NPC E2E — création UI');
    await dialog.locator('button[role="combobox"]').nth(1).click();
    await page.getByRole('option', { name: 'MATHEMATIQUES', exact: true }).click();

    const [response] = await Promise.all([
      page.waitForResponse((candidate) =>
        candidate.url().endsWith('/api/npc/submissions') && candidate.request().method() === 'POST'),
      dialog.getByRole('button', { name: 'Créer et uploader' }).click(),
    ]);
    expect(response.status(), await response.text()).toBe(201);
    await expect(page).toHaveURL(/\/dashboard\/coach\/npc\/submissions\/[^/]+\/upload$/);
    await expect(page.getByRole('heading', { name: 'Upload de copie' })).toBeVisible();
  });

  test('upload page shows instructions for the deterministic pending copy', async ({ page }) => {
    await page.goto('/dashboard/coach/npc');
    const copy = page.getByText('NPC E2E — copie affectée', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"hover:shadow-md")]');
    await copy.getByRole('link', { name: 'Gérer les documents' }).click();

    await expect(page).toHaveURL(/\/dashboard\/coach\/npc\/submissions\/[^/]+\/upload$/);
    await expect(page.getByRole('heading', { name: 'Instructions' })).toBeVisible();
    await expect(page.getByText('Formats acceptés', { exact: true })).toBeVisible();
    await expect(page.getByText('PDF (recommandé)', { exact: true })).toBeVisible();
  });

  test('unknown diagnostic report fails closed to the coach dashboard', async ({ page }) => {
    await page.goto('/dashboard/coach/npc/reports/report-inexistant');
    await expect(page).toHaveURL(/\/dashboard\/coach\/npc$/);
    await expect(page.getByRole('heading', { name: 'Nexus Pédagogie' })).toBeVisible();
  });

  test('submission list filters by every current status tab', async ({ page }) => {
    await page.goto('/dashboard/coach/npc');
    for (const tab of ['En attente', 'En cours', 'Terminées']) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    }
  });
});
