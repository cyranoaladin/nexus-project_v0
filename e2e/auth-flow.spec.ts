import { expect, test } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should allow user to register, login, and logout successfully', async ({ page }) => {
    // Step 1: Navigate to homepage
    await page.goto('/');
    await expect(page).toHaveTitle(/Nexus Réussite/);

    // Step 2: Click on "Commencer mon Bilan Stratégique Gratuit" button
    await page.click('text=Commencer mon Bilan Stratégique Gratuit');
    await expect(page).toHaveURL('/bilan-gratuit');

    // Step 3: Fill the registration form with test data
    const timestamp = Date.now();
    const testEmail = `test.parent.${timestamp}@nexus-test.com`;

    // Parent information
    await page.fill('[name="parentFirstName"]', 'Jean');
    await page.fill('[name="parentLastName"]', 'Dupont');
    await page.fill('[name="parentEmail"]', testEmail);
    await page.fill('[name="parentPhone"]', '0123456789');
    await page.fill('[name="parentPassword"]', 'motdepasse123');

    // Student information
    await page.fill('[name="studentFirstName"]', 'Marie');
    await page.fill('[name="studentLastName"]', 'Dupont');
    await page.selectOption('[name="studentGrade"]', 'Terminale');
    await page.fill('[name="studentSchool"]', 'Lycée Victor Hugo');

    // Subjects and objectives
    await page.check('[value="MATHEMATIQUES"]');
    await page.selectOption('[name="currentLevel"]', 'Moyen');
    await page.fill('[name="objectives"]', 'Améliorer les notes en mathématiques pour le baccalauréat');

    // Preferences
    await page.check('[value="hybride"]');

    // Consent
    await page.check('[name="acceptTerms"]');

    // Submit the form
    await page.click('button[type="submit"]');

    // Step 4: Verify redirection to dashboard or confirmation page
    await expect(page).toHaveURL(/\/dashboard|\/bilan-gratuit\/confirmation/);

    // If redirected to confirmation page, go to dashboard
    if (page.url().includes('/confirmation')) {
      await page.goto('/dashboard');
    }

    // Verify we're in the dashboard
    await expect(page.locator('text=Tableau de bord')).toBeVisible();

    // Step 5: Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Se Déconnecter');

    // Verify we're redirected to homepage or login page
    await expect(page).toHaveURL(/\/|\/auth\/signin/);

    // Step 6: Navigate to login page
    await page.goto('/auth/signin');

    // Step 7: Login with previously created credentials
    await page.fill('[name="email"]', testEmail);
    await page.fill('[name="password"]', 'motdepasse123');
    await page.click('button[type="submit"]');

    // Step 8: Verify successful login and redirection to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Tableau de bord')).toBeVisible();
  });

  test('should show error for invalid login credentials', async ({ page }) => {
    await page.goto('/auth/signin');

    // Try to login with invalid credentials
    await page.fill('[name="email"]', 'invalid@test.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Verify error message is displayed
    await expect(page.locator('text=Identifiants invalides')).toBeVisible();

    // Verify we're still on the login page
    await expect(page).toHaveURL('/auth/signin');
  });

  test('should validate required fields in registration form', async ({ page }) => {
    await page.goto('/bilan-gratuit');

    // Try to submit form without filling required fields
    await page.click('button[type="submit"]');

    // Verify validation errors are displayed
    await expect(page.locator('text=Le prénom doit contenir au moins 2 caractères')).toBeVisible();
    await expect(page.locator('text=Email invalide')).toBeVisible();
  });
});
