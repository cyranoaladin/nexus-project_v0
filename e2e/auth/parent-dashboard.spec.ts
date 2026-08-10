import { expect, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { attachCoreApiGuard, assertNoCoreApiFailure } from '../helpers/fail-on-core-500';

test.describe('Parent dashboard — current contract', () => {
  test.beforeEach(async ({ page }) => {
    attachCoreApiGuard(page);
    await loginAsUser(page, 'parent');
    await expect(page.getByRole('heading', { name: 'Espace Famille' })).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    assertNoCoreApiFailure(page);
  });

  test('shows the authenticated parent and every seeded child', async ({ page }) => {
    await expect(page.getByLabel('Profil utilisateur').getByText('Marie Dupont', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Mes Enfants/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lina', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Karim', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Yasmine', exact: true })).toBeVisible();
  });

  test('exposes the three canonical family rubriques', async ({ page }) => {
    for (const name of ['Mes Enfants', 'Facturation', 'Alertes']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
  });

  test('facturation summarizes the family without a stale child selector', async ({ page }) => {
    await page.getByRole('button', { name: 'Facturation', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Facturation Groupée' })).toBeVisible();
    await expect(page.getByText('Total Mensuel')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gérer mes abonnements' })).toBeVisible();
  });

  test('alerts opens the consolidated family view', async ({ page }) => {
    await page.getByRole('button', { name: 'Alertes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nexus Performance' })).toBeVisible();
  });
});
