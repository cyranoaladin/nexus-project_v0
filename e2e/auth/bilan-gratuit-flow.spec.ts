import { test, expect } from '@playwright/test';

test.describe('Bilan gratuit multi-step', () => {
  test('validates step 1 and advances to step 2', async ({ page }) => {
    await page.goto('/bilan-gratuit', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /Créez Votre Compte Parent et Élève/i })).toBeVisible();

    // Fill step 1
    const firstName = page.locator('#parentFirstName:visible');
    const lastName = page.locator('#parentLastName:visible');
    const email = page.locator('#parentEmail:visible');
    const phone = page.locator('#parentPhone:visible');
    const password = page.locator('#parentPassword:visible');

    const uniqueEmail = `e2e-bilan-${Date.now()}@test.com`;
    await firstName.fill('Parent');
    await lastName.fill('Test');
    await email.fill(uniqueEmail);
    await phone.fill('+21699112233');
    await password.fill('Test1234!');

    // Guard against hydration re-render clearing uncontrolled input state.
    await expect(firstName).toHaveValue('Parent');
    await expect(lastName).toHaveValue('Test');
    await expect(email).toHaveValue(uniqueEmail);
    await expect(phone).toHaveValue('+21699112233');
    await expect(password).toHaveValue('Test1234!');

    const nextButton = page.getByRole('button', { name: /Suivant/i });
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    // Step transition can be slightly delayed depending on hydration/network.
    await expect(page.getByText(/Étape 2 sur 2/i)).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole('heading', { name: /Étape 2 : Informations Élève/i })
    ).toBeVisible({ timeout: 15000 });
  });
});
