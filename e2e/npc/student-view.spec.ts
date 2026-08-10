import { expect, test } from '@playwright/test';

import { loginAsUser } from '../helpers/auth';

test.describe('NPC Student View', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'student');
  });

  test('student can navigate to diagnostics page', async ({ page }) => {
    await page.getByText('Mes Diagnostics', { exact: true }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/eleve\/npc$/);
    await expect(page.getByRole('heading', { name: 'Mes Diagnostics' })).toBeVisible();
    await expect(page.getByText(/Consultez les analyses/)).toBeVisible();
  });

  test('student sees their diagnostic stats', async ({ page }) => {
    await page.goto('/dashboard/eleve/npc');
    for (const label of ['Diagnostics reçus', 'Matières couvertes', 'En cours']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test('student can switch between tabs', async ({ page }) => {
    await page.goto('/dashboard/eleve/npc');
    await page.getByRole('tab', { name: /^En cours/ }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await page.getByRole('tab', { name: /^Mes diagnostics/i }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('student sees the pending copy without a fake completed report route', async ({ page }) => {
    await page.goto('/dashboard/eleve/npc');
    await page.getByRole('tab', { name: /^En cours/ }).click();
    const pendingCopy = page
      .getByText('NPC E2E — copie affectée', { exact: true })
      .locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " border ")][1]');
    await expect(pendingCopy).toBeVisible();
    await expect(pendingCopy.getByText('En attente', { exact: true })).toBeVisible();
    await expect(pendingCopy.getByRole('link', { name: /Voir mon diagnostic/ })).toHaveCount(0);
  });

  test('student cannot access coach pages', async ({ page }) => {
    await page.goto('/dashboard/coach/npc');
    await expect(page).toHaveURL(/\/dashboard\/eleve$/);
    await expect(page.getByRole('button', { name: 'Nouvelle copie' })).toHaveCount(0);
  });
});
