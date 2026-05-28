import { expect, test } from '@playwright/test';

const email = process.env.E2E_STUDENT_EMAIL;
const password = process.env.E2E_STUDENT_PASSWORD;
const allowMutation = process.env.ALLOW_EAM_MUTATION_E2E === 'true';

async function readRemoteProgress(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/eam/progress');
    return {
      status: response.status,
      body: await response.json().catch(() => null),
    };
  });
}

test.describe('EAM Première - élève authentifié', () => {
  test.skip(!email || !password, 'E2E_STUDENT_EMAIL et E2E_STUDENT_PASSWORD sont requis.');
  test.skip(!allowMutation, 'Test mutationnel désactivé par défaut. Définir ALLOW_EAM_MUTATION_E2E=true pour l’exécuter.');

  test('affiche le module, rend les formules et persiste la progression', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });

    await page.getByTestId('input-email').click();
    await page.keyboard.type(email!);
    await page.getByTestId('input-password').click();
    await page.keyboard.type(password!);
    await page.keyboard.press('Enter');

    await page.waitForURL(/\/dashboard\/eleve/, { timeout: 20_000 });
    await page.goto('/dashboard/eleve', { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /EAM Maths/ }).click();

    await expect(page.getByText('Épreuve Anticipée de Mathématiques')).toBeVisible();
    await expect(page.getByText('Première générale')).toBeVisible();
    await expect(page.getByText('spécialité mathématiques')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Plan J-11', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Modules', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fiches express', exact: true })).toBeVisible();

    await expect(page.getByText('Premiere generale')).toHaveCount(0);
    await expect(page.getByText('Epreuve Anticipee')).toHaveCount(0);
    await expect(page.getByText('Mathematiques')).toHaveCount(0);

    await page.getByRole('button', { name: 'Modules', exact: true }).click();
    await page.getByTestId('eam-open-module-auto').click();
    await expect(page.locator('.katex').first()).toBeVisible();

    const body = page.locator('body');
    await expect(body).not.toContainText('racine(Delta)');
    await expect(body).not.toContainText('u_(n+1)');
    await expect(body).not.toContainText('->');
    await expect(body).not.toContainText('tau =');

    await page.getByRole('button', { name: 'Quiz' }).click();
    await page.getByTestId('eam-start-quiz').click();

    for (let step = 0; step < 8; step += 1) {
      const answer = page.getByTestId('eam-answer-0');
      if (!(await answer.isVisible().catch(() => false))) break;
      await answer.click();
      await page.getByTestId('eam-next-question').click();
      if (await page.getByText('Résultat sauvegardé.').isVisible().catch(() => false)) break;
    }
    await expect(page.getByText('Résultat sauvegardé.')).toBeVisible();
    await expect
      .poll(async () => {
        const progress = await readRemoteProgress(page);
        return progress.status === 200 && progress.body?.data?.quiz?.auto?.done === true;
      }, { timeout: 10_000 })
      .toBe(true);

    await page.getByRole('button', { name: 'Checklist', exact: true }).click();
    const firstChecklistItem = page.getByTestId('eam-check-auto_0');
    if ((await firstChecklistItem.getAttribute('aria-pressed')) !== 'true') {
      await firstChecklistItem.click();
    }

    await expect
      .poll(async () => {
        const progress = await readRemoteProgress(page);
        return progress.status === 200 && progress.body?.data?.checks?.auto_0 === true;
      }, { timeout: 10_000 })
      .toBe(true);

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /EAM Maths/ }).click();
    await page.getByRole('button', { name: 'Modules', exact: true }).click();
    await page.getByTestId('eam-open-module-auto').click();
    await page.getByRole('button', { name: 'Quiz' }).click();
    await expect(page.getByText(/Dernier score :/)).toBeVisible();
    await page.getByRole('button', { name: 'Checklist', exact: true }).click();
    await expect(page.getByTestId('eam-check-auto_0')).toHaveAttribute('aria-pressed', 'true');
  });
});
