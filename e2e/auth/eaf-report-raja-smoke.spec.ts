import { expect, test } from '@playwright/test';

import { loginAsUser } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';
import { disconnectPrisma, getStudentId } from '../helpers/db';

test('EAF preparation report persists on the disposable coach fixture', async ({ page }) => {
  const studentId = await getStudentId(CREDS.student.email);
  await loginAsUser(page, 'coach');

  await page.goto(`/dashboard/coach/eleve/${studentId}`, { waitUntil: 'domcontentloaded' });

  const eafSection = page.getByTestId('eaf-preparation-report');
  await expect(eafSection).toBeVisible({ timeout: 15_000 });

  const textareas = eafSection.locator('textarea');
  const linearReading = textareas.first();
  const goals = textareas.nth(1);
  const marker = `E2E EAF ${Date.now()}`;

  await linearReading.fill(`${marker} lecture linéaire`);
  await goals.fill(`${marker} objectif`);
  await eafSection.getByRole('button', { name: /enregistrer/i }).click();
  await expect(eafSection.getByText(/Brouillon sauvegardé/i)).toBeVisible({ timeout: 10_000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('eaf-preparation-report').locator('textarea').first())
    .toHaveValue(`${marker} lecture linéaire`);
  await expect(page.getByTestId('eaf-preparation-report').locator('textarea').nth(1))
    .toHaveValue(`${marker} objectif`);

  await disconnectPrisma();
});
