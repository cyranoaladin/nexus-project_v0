import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

test.describe('Parcours élève STMG Mode Survie', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'studentSurvival');
  });

  test('affiche les zones tactiques et persiste une copie de phrase', async ({ page }) => {
    await page.goto('/dashboard/eleve');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Parcours' }).click();
    await expect(page.getByLabel(/Mode Survie STMG/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Coffre des 7 réflexes')).toBeVisible();
    await expect(page.getByText('8 phrases magiques')).toBeVisible();
    await expect(page.getByText("Le jour J, tu remplis 100 % du QCM.").first()).toBeVisible();

    await page.getByRole('button', { name: /Copier la phrase magique/i }).first().click();
    await expect(page.getByText(/Copiée [1-9][0-9]* fois/i).first()).toBeVisible();

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: 'Parcours' }).click();
    await expect(page.getByLabel(/Mode Survie STMG/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Copiée [1-9][0-9]* fois/i).first()).toBeVisible();
  });
});
