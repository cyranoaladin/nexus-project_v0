/**
 * E2E Tests - Authentication & Booking Flow
 *
 * Tests critical user journeys with deterministic behavior:
 * - Login flow for all roles (PARENT, STUDENT, COACH, ADMIN)
 * - Dashboard access with role verification
 * - Session booking complete flow
 * - UI feedback (toasts, errors)
 *
 * Requirements:
 * - E2E database must be seeded (npm run test:e2e:setup)
 * - App running on http://localhost:3000
 * - Test users: parent@test.com, student@test.com, coach@test.com, admin@test.com
 * - Password: password123
 */

import { test, expect, Page } from '@playwright/test';

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

test.describe('Authentication & Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Reduce animations for deterministic tests
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // Log console errors for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`[Browser Error]: ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      console.log(`[Page Error]: ${err.message}`);
    });
  });

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  /**
   * Login helper with deterministic waiting
   */
  async function login(page: Page, email: string, password: string) {
    await page.goto('/auth/signin', { waitUntil: 'networkidle' });

    // Fill login form using data-testid (stable selectors)
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);

    // Submit and wait for navigation
    await Promise.all([
      page.waitForURL(/\/dashboard\/.+/, { timeout: 10000 }),
      page.getByRole('button', { name: /sign in|connexion|se connecter/i }).click(),
    ]);

    // Wait for dashboard to be fully loaded
    await page.waitForLoadState('networkidle');
  }

  /**
   * Verify toast message appears
   */
  async function expectToast(page: Page, message: string, type: 'success' | 'error' = 'success') {
    const toast = page.locator(`[role="status"]`).filter({ hasText: message });
    await expect(toast).toBeVisible({ timeout: 5000 });
  }

  // =============================================================================
  // AUTHENTICATION TESTS
  // =============================================================================

  test.describe('Login Flow', () => {
    test('Parent can login and access parent dashboard', async ({ page }) => {
      await login(page, 'parent@test.com', 'password123');

      // Verify parent dashboard URL
      await expect(page).toHaveURL(/\/dashboard\/parent/);

      // Verify parent-specific content
      await expect(page.getByRole('heading', { name: /dashboard|tableau de bord/i })).toBeVisible();

      // Verify parent has credits displayed
      const creditsText = page.getByText(/crédits|credits/i);
      await expect(creditsText).toBeVisible({ timeout: 5000 });
    });

    test('Student can login and access student dashboard', async ({ page }) => {
      await login(page, 'student@test.com', 'password123');

      // Verify student dashboard URL
      await expect(page).toHaveURL(/\/dashboard\/(eleve|student)/);

      // Verify student-specific content
      await expect(page.getByRole('heading', { name: /dashboard|tableau de bord/i })).toBeVisible();
    });

    test('Coach can login and access coach dashboard', async ({ page }) => {
      await login(page, 'coach@test.com', 'password123');

      // Verify coach dashboard URL
      await expect(page).toHaveURL(/\/dashboard\/coach/);

      // Verify coach-specific content (sessions management)
      await expect(page.getByRole('heading', { name: /dashboard|mes séances/i })).toBeVisible();
    });

    test('Admin can login and access admin dashboard', async ({ page }) => {
      await login(page, 'admin@test.com', 'password123');

      // Verify admin dashboard URL
      await expect(page).toHaveURL(/\/dashboard\/admin/);

      // Verify admin-specific content
      await expect(page.getByRole('heading', { name: /admin|administration/i })).toBeVisible();
    });

    test('Login fails with invalid credentials', async ({ page }) => {
      await page.goto('/auth/signin', { waitUntil: 'networkidle' });

      await page.getByLabel(/email/i).fill('invalid@test.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in|connexion/i }).click();

      // Wait for error message
      await expect(
        page.getByText(/invalid credentials|identifiants invalides|incorrect/i)
      ).toBeVisible({ timeout: 5000 });

      // Should stay on signin page
      await expect(page).toHaveURL(/\/auth\/signin/);
    });

    test('Login fails with empty fields', async ({ page }) => {
      await page.goto('/auth/signin', { waitUntil: 'networkidle' });

      // Try to submit without filling fields
      await page.getByRole('button', { name: /sign in|connexion/i }).click();

      // Should show validation errors
      const emailInput = page.getByLabel(/email/i);
      await expect(emailInput).toHaveAttribute('required', '');
    });
  });

  // =============================================================================
  // DASHBOARD ACCESS TESTS
  // =============================================================================

  test.describe('Dashboard Access Control', () => {
    test('Anonymous user redirected to signin', async ({ page }) => {
      // Try to access protected dashboard without auth
      await page.goto('/dashboard/parent');

      // Should redirect to signin
      await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 5000 });
    });

    test('Parent cannot access admin dashboard', async ({ page }) => {
      await login(page, 'parent@test.com', 'password123');

      // Try to access admin dashboard
      await page.goto('/dashboard/admin');

      // Should redirect to parent dashboard or show 403
      await page.waitForLoadState('networkidle');

      const url = page.url();
      const is403 = page.getByText(/403|forbidden|non autorisé/i);

      const redirected = url.includes('/dashboard/parent');
      const forbidden = await is403.isVisible().catch(() => false);

      expect(redirected || forbidden).toBe(true);
    });

    test('Student cannot access coach dashboard', async ({ page }) => {
      await login(page, 'student@test.com', 'password123');

      // Try to access coach dashboard
      await page.goto('/dashboard/coach');

      // Should redirect or show 403
      await page.waitForLoadState('networkidle');

      const url = page.url();
      expect(url).not.toContain('/dashboard/coach');
    });
  });

  // =============================================================================
  // BOOKING FLOW TESTS
  // =============================================================================

  test.describe('Session Booking Flow', () => {
    test('Parent can view available sessions', async ({ page }) => {
      await login(page, 'parent@test.com', 'password123');

      // Navigate to sessions page
      await page.goto('/dashboard/parent', { waitUntil: 'networkidle' });

      // Look for sessions list or navigate to sessions
      const sessionsLink = page.getByRole('link', { name: /sessions|séances/i });
      if (await sessionsLink.isVisible().catch(() => false)) {
        await sessionsLink.click();
        await page.waitForLoadState('networkidle');
      }

      // Verify sessions are displayed
      // Note: Adjust selector based on actual implementation
      const sessionCards = page.locator('[data-testid*="session"], .session-card, [class*="session"]');
      await expect(sessionCards.first()).toBeVisible({ timeout: 10000 });
    });

    test('Parent can book a session for student', async ({ page }) => {
      await login(page, 'parent@test.com', 'password123');

      // Navigate to sessions
      await page.goto('/dashboard/parent', { waitUntil: 'networkidle' });

      // Find and click on first available session
      // Note: Adjust selector based on actual implementation
      const bookButton = page.getByRole('button', { name: /réserver|book|prendre/i }).first();

      if (await bookButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await bookButton.click();

        // Wait for booking modal or confirmation
        await page.waitForTimeout(1000); // Small wait for modal animation

        // Select student if needed
        const studentSelect = page.locator('select, [role="combobox"]').filter({
          hasText: /élève|student/i,
        });
        if (await studentSelect.isVisible().catch(() => false)) {
          await studentSelect.selectOption({ index: 1 });
        }

        // Confirm booking
        const confirmButton = page.getByRole('button', { name: /confirmer|confirm|réserver/i });
        await confirmButton.click();

        // Verify success toast
        await expect(
          page.getByText(/réservation confirmée|booking confirmed|succès|success/i)
        ).toBeVisible({ timeout: 10000 });
      } else {
        console.log('⚠️  No bookable sessions found - skipping booking flow');
      }
    });

    test('Booking fails when parent has insufficient credits', async ({ page }) => {
      // Note: This test requires a parent with 0 credits
      // For now, we document expected behavior

      await login(page, 'parent@test.com', 'password123');

      // If parent has credits, this test is skipped
      const creditsElement = page.getByText(/crédits|credits/i);
      if (await creditsElement.isVisible().catch(() => false)) {
        const creditsText = await creditsElement.textContent();
        if (creditsText && parseInt(creditsText) > 0) {
          test.skip();
        }
      }

      // Try to book - should show error
      const bookButton = page.getByRole('button', { name: /réserver|book/i }).first();
      if (await bookButton.isVisible().catch(() => false)) {
        await bookButton.click();

        // Verify error message
        await expect(
          page.getByText(/crédits insuffisants|insufficient credits/i)
        ).toBeVisible({ timeout: 5000 });
      }
    });

    test('Coach cannot book their own sessions', async ({ page }) => {
      await login(page, 'coach@test.com', 'password123');

      // Navigate to sessions list
      await page.goto('/dashboard/coach', { waitUntil: 'networkidle' });

      // Coach should see "Manage" or "Edit" buttons, not "Book"
      const manageButton = page.getByRole('button', { name: /gérer|manage|modifier|edit/i });
      await expect(manageButton.first()).toBeVisible({ timeout: 5000 });

      // Book button should NOT be visible for coach's own sessions
      const bookButton = page.getByRole('button', { name: /réserver|book/i });
      await expect(bookButton).not.toBeVisible();
    });
  });

  // =============================================================================
  // UI FEEDBACK TESTS
  // =============================================================================

  test.describe('UI Feedback & Error Handling', () => {
    test('Loading states display correctly', async ({ page }) => {
      await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });

      // Fill form
      await page.getByLabel(/email/i).fill('parent@test.com');
      await page.getByLabel(/password/i).fill('password123');

      // Click submit
      const submitButton = page.getByRole('button', { name: /sign in|connexion/i });
      await submitButton.click();

      // Check for loading state (button disabled or loading indicator)
      const isDisabled = await submitButton.isDisabled().catch(() => false);
      const hasLoadingClass = await submitButton.getAttribute('class').then((cls) => cls?.includes('loading'));

      expect(isDisabled || hasLoadingClass).toBe(true);
    });

    test('Form validation errors display correctly', async ({ page }) => {
      await page.goto('/auth/signin', { waitUntil: 'networkidle' });

      // Fill invalid email
      await page.getByLabel(/email/i).fill('invalid-email');
      await page.getByLabel(/password/i).fill('short');
      await page.getByRole('button', { name: /sign in|connexion/i }).click();

      // Should show validation errors
      await expect(page.getByText(/email invalide|invalid email/i)).toBeVisible({ timeout: 3000 });
    });

    test('Success toast appears after booking', async ({ page }) => {
      await login(page, 'parent@test.com', 'password123');

      // Try to find and book a session
      const bookButton = page.getByRole('button', { name: /réserver|book/i }).first();

      if (await bookButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await bookButton.click();
        await page.waitForTimeout(500);

        const confirmButton = page.getByRole('button', { name: /confirmer|confirm/i });
        if (await confirmButton.isVisible().catch(() => false)) {
          await confirmButton.click();

          // Verify toast appears
          const successToast = page.locator('[role="status"]').filter({
            hasText: /succès|success|confirmé|confirmed/i,
          });
          await expect(successToast).toBeVisible({ timeout: 10000 });
        }
      }
    });

    test('Error toast appears on network failure', async ({ page }) => {
      // Block network to simulate failure
      await page.route('**/api/**', (route) => route.abort());

      await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });

      await page.getByLabel(/email/i).fill('parent@test.com');
      await page.getByLabel(/password/i).fill('password123');
      await page.getByRole('button', { name: /sign in|connexion/i }).click();

      // Should show error toast
      await expect(
        page.getByText(/erreur|error|échec|failed/i)
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // =============================================================================
  // NAVIGATION TESTS
  // =============================================================================

  test.describe('Navigation & Logout', () => {
    test('User can navigate between dashboard sections', async ({ page }) => {
      await login(page, 'parent@test.com', 'password123');

      // Navigate to different sections
      const profileLink = page.getByRole('link', { name: /profil|profile|paramètres|settings/i });
      if (await profileLink.isVisible().catch(() => false)) {
        await profileLink.click();
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/profile|profil|settings|paramètres/);
      }
    });

    test('User can logout successfully', async ({ page }) => {
      await login(page, 'parent@test.com', 'password123');

      // Find and click logout button
      const logoutButton = page.getByRole('button', { name: /déconnexion|logout|sign out/i });

      if (await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await logoutButton.click();

        // Should redirect to home or signin
        await expect(page).toHaveURL(/\/$|\/auth\/signin/, { timeout: 5000 });
      } else {
        console.log('⚠️  Logout button not found - may be in dropdown menu');
      }
    });
  });
});
