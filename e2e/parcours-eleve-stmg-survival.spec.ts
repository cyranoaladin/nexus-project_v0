import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test.describe('Parcours élève STMG Mode Survie', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'studentSurvival');
  });

  test('affiche les zones tactiques et persiste une copie de phrase', async ({ page }) => {
    await page.goto('/dashboard/eleve');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel(/Mode Survie STMG/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Coffre des 7 reflexes')).toBeVisible();
    await expect(page.getByText('8 phrases magiques')).toBeVisible();
    await expect(page.getByText("Le jour J, tu remplis 100 % du QCM.")).toBeVisible();

    await page.getByRole('button', { name: /Copier la phrase magique/i }).first().click();
    await expect(page.getByText(/Copiee 1 fois|Copiee 2 fois|Copiee 3 fois/i).first()).toBeVisible();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByLabel(/Mode Survie STMG/i)).toBeVisible({ timeout: 15_000 });
  });
});
