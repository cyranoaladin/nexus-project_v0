import { expect, test } from '@playwright/test';

const email = process.env.E2E_STUDENT_EMAIL;
const password = process.env.E2E_STUDENT_PASSWORD;

const viewports = [
  { name: 'mini laptop', width: 1024, height: 600 },
  { name: 'petit laptop', width: 1280, height: 720 },
  { name: 'tablette', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

async function login(page: import('@playwright/test').Page) {
  await page.goto('/auth/signin', { waitUntil: 'networkidle' });
  await page.getByTestId('input-email').click();
  await page.keyboard.type(email!);
  await page.getByTestId('input-password').click();
  await page.keyboard.type(password!);
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/dashboard\/eleve/, { timeout: 20_000 });
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe('EAM Première responsive read-only', () => {
  test.skip(!email || !password, 'E2E_STUDENT_EMAIL et E2E_STUDENT_PASSWORD sont requis.');

  test('ouvre la page dédiée et ne déborde sur aucun viewport cible', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 600 });
    await login(page);

    await page.goto('/dashboard/eleve', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /EAM Maths/ }).click();
    await page.getByRole('link', { name: /Ouvrir EAM Maths/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/eleve\/eam/);

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/dashboard/eleve/eam', { waitUntil: 'networkidle' });

      await expect(page.getByText('Épreuve Anticipée de Mathématiques')).toBeVisible();
      await expect(page.getByText('Première générale')).toBeVisible();
      await expect(page.getByText('spécialité mathématiques')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Fiches express', exact: true })).toBeVisible();

      await expect(page.locator('body')).not.toContainText('Premiere generale');
      await expect(page.locator('body')).not.toContainText('Epreuve Anticipee');
      await expect(page.locator('body')).not.toContainText('Mathematiques');
      await expect(page.locator('body')).not.toContainText('racine(Delta)');
      await expect(page.locator('body')).not.toContainText('u_(n+1)');
      await expect(page.locator('body')).not.toContainText('tau =');
      await expect(page.locator('body')).not.toContainText('->');

      await page.getByRole('button', { name: 'Fiches express', exact: true }).click();
      await expect(page.locator('.katex').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.getByRole('button', { name: 'Sujet blanc', exact: true }).click();
      await expect(page.locator('.eam-mock-exam').getByRole('heading', { name: /^Sujet blanc$/ })).toBeVisible();
      await expect(page.getByText('Première spécialité mathématiques')).toBeVisible();
      await expect(page.getByText('Calculatrice interdite', { exact: true })).toBeVisible();
      await expect(page.getByText(/Sujet blanc\s+C/i)).toHaveCount(0);
      await expect(page.getByText(/Sujet\s+C/i)).toHaveCount(0);
      await expect(page.getByText(/plateforme\s+premium/i)).toHaveCount(0);
      await expect(page.getByText('Partie 1 — Automatismes, QCM')).toBeVisible();
      await expect(page.getByText('Probabilités conditionnelles')).toBeVisible();
      await expect(page.getByText('Suites et algorithmique')).toBeVisible();
      await expect(page.getByText('Analyse et exponentielle')).toBeVisible();
      await expect(page.locator('code').filter({ hasText: 'p = 1' })).toBeVisible();
      await expect(page.locator('code').filter({ hasText: 'u = 5' })).toBeVisible();
      await expect(page.locator('.eam-mock-exam .katex').first()).toBeVisible();
      await expect(page.locator('body')).not.toContainText('NexusFlix');
      await expect(page.locator('body')).not.toContainText('9500');
      await expect(page.locator('body')).not.toContainText('f(x)=(2x-1)e^{-x}+2');
      await expect(page.locator('body')).not.toContainText('racine(Delta)');
      await expect(page.locator('body')).not.toContainText('u_(n+1)');
      await expect(page.locator('body')).not.toContainText('tau =');
      await expect(page.locator('body')).not.toContainText('->');
      await expectNoHorizontalOverflow(page);
    }
  });
});
