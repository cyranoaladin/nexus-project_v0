import { test, expect } from '@playwright/test';

/**
 * Password Reset Flow — E2E Tests
 *
 * Verifies the forgot password page and reset password page behavior.
 */

test.describe('Password reset flow', () => {
  test('sign-in account CTA reaches the current bilan request journey', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
    const link = page.getByRole('link', { name: /Créer mon Compte Gratuit/i });
    await expect(link).toHaveAttribute('href', '/bilan-gratuit');
    await link.click();
    await expect(page).toHaveURL(/\/bilan-gratuit$/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('forgot-password return link reaches the usable sign-in form', async ({ page }) => {
    await page.goto('/auth/mot-de-passe-oublie', { waitUntil: 'domcontentloaded' });
    const link = page.getByRole('link', { name: /Retour à la connexion/i });
    await expect(link).toHaveAttribute('href', '/auth/signin');
    await link.click();
    await expect(page).toHaveURL(/\/auth\/signin$/);
    await expect(page.locator('#email')).toBeEnabled();
    await expect(page.locator('#password')).toBeEnabled();
  });

  test('forgot password page loads correctly', async ({ page }) => {
    await page.goto('/auth/mot-de-passe-oublie', { waitUntil: 'domcontentloaded' });
    const response = await page.goto('/auth/mot-de-passe-oublie');
    expect(response?.status()).toBeLessThan(400);

    // Should have an email input
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });

  test('forgot password form rejects empty email', async ({ page }) => {
    await page.goto('/auth/mot-de-passe-oublie', { waitUntil: 'domcontentloaded' });

    // Button copy is "Demander la récupération de mon accès" since the
    // email/WhatsApp recovery channels were unified (339dd8fa8) -- it no
    // longer says "envoyer" or "réinitialisation".
    const submitBtn = page.getByRole('button', { name: /demander la récupération/i });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();
    await expect(page).toHaveURL(/mot-de-passe-oublie/);
  });

  test('reset password page with invalid token shows error', async ({ page }) => {
    await page.goto('/auth/reset-password?token=invalid-token-xyz', { waitUntil: 'domcontentloaded' });
    const response = await page.goto('/auth/reset-password?token=invalid-token-xyz');
    // Should load (200) but show error message about invalid/expired token
    expect(response?.status()).toBeLessThan(500);
  });

  // Coverage restored after the E2E ownership rework (PR #235) deleted
  // e2e/auth/qa-auth-workflows.spec.ts's "has link to request new reset"
  // assertion without an equivalent replacement. Note: the "Lien invalide"
  // state (app/auth/reset-password/page.tsx) triggers on a MISSING token,
  // not a garbage-but-present one (a well-formed but wrong token only
  // surfaces its error after form submission, which is a distinct flow) --
  // the original deleted test made the same "no token" choice.
  test('reset password page without a token shows the invalid-link CTA', async ({ page }) => {
    await page.goto('/auth/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Lien invalide' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Demander un nouveau lien/i })).toHaveAttribute(
      'href',
      '/auth/mot-de-passe-oublie',
    );
  });

  test('signin page has forgot password link', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
    const forgotLink = page.locator('a[href*="mot-de-passe"]');
    await expect(forgotLink).toBeVisible({ timeout: 10000 });
  });

  // Coverage restored after the E2E ownership rework (PR #235) deleted
  // e2e/auth/auth-role-separation.spec.ts's "helper text distinguishing
  // parent vs eleve" assertion as a claimed duplicate of
  // rbac.dashboards.contract.spec.ts, which does not actually cover signin
  // page copy. Real current copy: app/auth/signin/SignInForm.tsx:278-283.
  test('signin page distingue explicitement les parcours Parent et Élève', async ({ page }) => {
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Parent ?', { exact: false })).toBeVisible();
    await expect(page.getByText('Élève ?', { exact: false })).toBeVisible();
  });
});
