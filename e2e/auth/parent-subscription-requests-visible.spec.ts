import { expect, type Page, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';

const BASE = process.env.BASE_URL || 'http://localhost:3002';

async function switchToAssistante(page: Page) {
  await page.context().clearCookies();
  await loginAsUser(page, 'assistante', {
    targetPath: '/dashboard/assistante/subscriptions?tab=requests',
  });
  await expect(page.getByRole('heading', { name: /Gestion des abonnements/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Demandes/i })).toBeVisible();
}

async function assertVisibleInAssistanteQueue(
  page: Page,
  expected: {
    requestType: 'PLAN_CHANGE' | 'ARIA_ADDON';
    planName: string;
    monthlyPrice: number;
  }
) {
  await switchToAssistante(page);

  await page.getByPlaceholder(/Rechercher/i).fill(expected.planName);

  const requestCard = page
    .locator('.shadow-premium')
    .filter({ hasText: expected.requestType })
    .filter({ hasText: expected.planName })
    .first();

  await expect(requestCard, `${expected.requestType} ${expected.planName} visible in assistante queue`).toBeVisible({
    timeout: 10_000,
  });
  await expect(requestCard).toContainText('Yasmine Dupont');
  await expect(requestCard).toContainText(CREDS.parent.email);
  await expect(requestCard).toContainText(`${expected.monthlyPrice} TND`);
  await expect(requestCard).toContainText('PENDING');
}

test('parent plan-change request appears in assistante requests queue', async ({ page }) => {
  test.setTimeout(60_000);

  await loginAsUser(page, 'parent', { targetPath: '/dashboard/parent/abonnements' });
  await expect(page.getByRole('heading', { name: /Gestion des Abonnements/i })).toBeVisible();

  await page.getByRole('button', { name: /Changer pour ACCÈS PLATEFORME/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  const successDialog = page.waitForEvent('dialog');
  await page.getByRole('button', { name: /Envoyer la Demande/i }).click();
  const dialog = await successDialog;
  expect(dialog.message()).toContain("Demande envoyée à l'assistant");
  await dialog.accept();

  await assertVisibleInAssistanteQueue(page, {
    requestType: 'PLAN_CHANGE',
    planName: 'ACCES_PLATEFORME',
    monthlyPrice: 150,
  });
});

test('parent ARIA add-on request appears in assistante requests queue', async ({ page }) => {
  test.setTimeout(60_000);

  await loginAsUser(page, 'parent', { targetPath: '/dashboard/parent/abonnements' });
  await expect(page.getByRole('heading', { name: /Gestion des Abonnements/i })).toBeVisible();

  const successDialog = page.waitForEvent('dialog');
  await expect(page.getByRole('heading', { name: /Analyse approfondie ARIA/i })).toBeVisible();
  await page
    .getByRole('button', { name: /Ajouter cet Add-on/i })
    .nth(1)
    .click();
  const dialog = await successDialog;
  expect(dialog.message()).toContain("Demande envoyée à l'assistant");
  await dialog.accept();

  await assertVisibleInAssistanteQueue(page, {
    requestType: 'ARIA_ADDON',
    planName: 'ANALYSE_APPROFONDIE',
    monthlyPrice: 75,
  });
});
