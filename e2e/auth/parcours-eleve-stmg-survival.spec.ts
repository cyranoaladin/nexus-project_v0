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

    // The card increments its counter optimistically and swallows the result of
    // the POST that persists it, so the visible count proves nothing about
    // persistence. click() also resolves once the handler is dispatched, not
    // when its awaited fetch settles — reloading here can abort the write in
    // flight and lose the very thing this test is named for. Wait for the write
    // to land, and assert it actually succeeded: the route rate-limits one copy
    // per user and phrase per second and answers 429, which the client hides.
    const persisted = page.waitForResponse(response =>
      /^\/api\/student\/survival\/phrases\/[^/]+\/copied$/.test(new URL(response.url()).pathname)
      && response.request().method() === 'POST');
    await page.getByRole('button', { name: /Copier la phrase magique/i }).first().click();
    await expect(page.getByText(/Copiée [1-9][0-9]* fois/i).first()).toBeVisible();
    expect((await persisted).status()).toBe(200);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: 'Parcours' }).click();
    await expect(page.getByLabel(/Mode Survie STMG/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Copiée [1-9][0-9]* fois/i).first()).toBeVisible();
  });
});
