import { test, expect } from '@playwright/test';

test.describe('Bilan gratuit mono-page', () => {
  test('valide les champs requis puis accepte une demande complète', async ({ page }) => {
    await page.goto('/bilan-gratuit', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /bilan/i }).first()).toBeVisible();
    await page.getByRole('button', { name: /créer mon espace/i }).click();
    await expect(page.locator('[role="alert"]').first()).toBeVisible();

    // Fill step 1
    const firstName = page.locator('#parentFirstName:visible');
    const lastName = page.locator('#parentLastName:visible');
    const email = page.locator('#parentEmail:visible');
    const phone = page.locator('#parentPhone:visible');
    const uniqueEmail = `e2e-bilan-${Date.now()}@test.com`;
    await firstName.fill('Parent');
    await lastName.fill('Test');
    await email.fill(uniqueEmail);
    await phone.fill('+21699112233');
    await page.locator('#studentFirstName').fill('Élève');
    await page.locator('#studentGrade').selectOption('premiere');
    await page.locator('label').filter({ hasText: /J.accepte d.être contacté/ }).getByRole('checkbox').click();

    // Guard against hydration re-render clearing uncontrolled input state.
    await expect(firstName).toHaveValue('Parent');
    await expect(lastName).toHaveValue('Test');
    await expect(email).toHaveValue(uniqueEmail);
    await expect(phone).toHaveValue('+21699112233');
    const submit = page.getByRole('button', { name: /créer mon espace/i });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(/\/bilan-gratuit\/confirmation/, { timeout: 15000 });
  });
});
