import { expect, test } from '@playwright/test';

test.describe('Subscription Selection Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a test parent user before each test
    // Note: This assumes test data exists in the database
    await page.goto('/auth/signin');
    await page.fill('[name="email"]', 'test.parent@nexus-test.com');
    await page.fill('[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    // Verify login success
    await expect(page).toHaveURL('/dashboard');
  });

  test('should allow user to select Hybride plan and proceed to payment', async ({ page }) => {
    // Step 1: Navigate to offers page
    await page.goto('/offres');
    await expect(page).toHaveTitle(/Nos Offres/);

    // Step 2: Locate the "Hybride" plan section
    const hybrideSection = page.locator('[data-plan="hybride"]');
    await expect(hybrideSection).toBeVisible();

    // Verify the plan details are displayed
    await expect(hybrideSection.locator('text=Formule Hybride')).toBeVisible();
    await expect(hybrideSection.locator('text=Présentiel + En ligne')).toBeVisible();

    // Step 3: Click on "Choisir ce plan" for the Hybride formula
    await hybrideSection.locator('button:has-text("Choisir ce plan")').click();

    // Step 4: Verify redirection to payment tunnel
    await expect(page).toHaveURL(/\/dashboard\/parent\/paiement/);

    // Verify we're in the payment page
    await expect(page.locator('text=Choisir votre mode de paiement')).toBeVisible();

    // Verify plan selection is reflected
    await expect(page.locator('text=Formule Hybride')).toBeVisible();

    // Step 5: Test payment method selection (Konnect demo)
    await page.click('button:has-text("Payer avec Konnect")');

    // Should redirect to Konnect demo page
    await expect(page).toHaveURL(/\/dashboard\/parent\/paiement\/konnect-demo/);
    await expect(page.locator('text=Simulation de paiement Konnect')).toBeVisible();

    // Step 6: Complete demo payment
    await page.fill('[name="cardNumber"]', '4000000000000002');
    await page.fill('[name="expiryDate"]', '12/25');
    await page.fill('[name="cvv"]', '123');
    await page.click('button:has-text("Confirmer le paiement")');

    // Verify payment confirmation
    await expect(page.locator('text=Paiement simulé avec succès')).toBeVisible();
  });

  test('should allow user to select Wise payment method', async ({ page }) => {
    await page.goto('/offres');

    // Select any plan (e.g., Essential)
    const essentialSection = page.locator('[data-plan="essential"]');
    await essentialSection.locator('button:has-text("Choisir ce plan")').click();

    await expect(page).toHaveURL(/\/dashboard\/parent\/paiement/);

    // Select Wise payment method
    await page.click('button:has-text("Payer avec Wise")');

    // Should redirect to Wise payment page
    await expect(page).toHaveURL(/\/dashboard\/parent\/paiement\/wise/);
    await expect(page.locator('text=Paiement via Wise')).toBeVisible();

    // Verify Wise payment form elements
    await expect(page.locator('[name="amount"]')).toBeVisible();
    await expect(page.locator('[name="currency"]')).toBeVisible();
    await expect(page.locator('button:has-text("Procéder au paiement")')).toBeVisible();
  });

  test('should display plan comparison correctly', async ({ page }) => {
    await page.goto('/offres');

    // Verify all plans are displayed
    await expect(page.locator('[data-plan="essential"]')).toBeVisible();
    await expect(page.locator('[data-plan="hybride"]')).toBeVisible();
    await expect(page.locator('[data-plan="premium"]')).toBeVisible();

    // Verify plan features are displayed
    await expect(page.locator('text=10 crédits/mois')).toBeVisible();
    await expect(page.locator('text=20 crédits/mois')).toBeVisible();
    await expect(page.locator('text=40 crédits/mois')).toBeVisible();

    // Verify pricing is displayed
    await expect(page.locator('text=59€/mois')).toBeVisible();
    await expect(page.locator('text=99€/mois')).toBeVisible();
    await expect(page.locator('text=159€/mois')).toBeVisible();

    // Test plan comparison table if available
    const comparisonButton = page.locator('button:has-text("Comparer les offres")');
    if (await comparisonButton.isVisible()) {
      await comparisonButton.click();
      await expect(page.locator('[data-testid="comparison-table"]')).toBeVisible();
    }
  });

  test('should handle unauthenticated user trying to select plan', async ({ page }) => {
    // Logout first
    await page.goto('/dashboard');
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Se Déconnecter');

    // Navigate to offers page without authentication
    await page.goto('/offres');

    // Try to select a plan
    const hybrideSection = page.locator('[data-plan="hybride"]');
    await hybrideSection.locator('button:has-text("Choisir ce plan")').click();

    // Should redirect to login page
    await expect(page).toHaveURL('/auth/signin');
    await expect(page.locator('text=Vous devez vous connecter')).toBeVisible();
  });
});
