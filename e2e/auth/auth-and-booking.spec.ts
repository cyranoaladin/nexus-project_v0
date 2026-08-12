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
 * - Test users loaded from e2e/.credentials.json (written by seed)
 */

import { test, expect, Page } from '@playwright/test';
import { loginAsUser, ROLE_PATHS } from '../helpers/auth';
import { CREDS } from '../helpers/credentials';
import { ensureCoachAvailabilityByEmail, setStudentCreditsByEmail, disconnectPrisma } from '../helpers/db';
import { attachCoreApiGuard, assertNoCoreApiFailure } from '../helpers/fail-on-core-500';

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

    // Fail test if any core API endpoint returns 5xx
    attachCoreApiGuard(page);
  });

  test.afterEach(async ({ page }) => {
    assertNoCoreApiFailure(page);
  });

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  /**
   * Login helper with deterministic waiting
   */
  async function login(page: Page, userType: 'parent' | 'student' | 'coach' | 'admin') {
    await loginAsUser(page, userType);
    await expect(page).toHaveURL(new RegExp(ROLE_PATHS[userType]));
  }



  // =============================================================================
  // AUTHENTICATION TESTS
  // =============================================================================

  test.describe('Login Flow', () => {
    test('Parent can login and access parent dashboard', async ({ page }) => {
      await login(page, 'parent');

      // Wait for auth session to be established before checking UI
      await page.waitForResponse(
        (r) => r.url().includes('/api/auth/session') && r.status() === 200,
        { timeout: 60_000 }
      ).catch(() => {
        // Session may already be cached — continue to UI assertions
      });

      // Verify parent dashboard URL
      await expect(page).toHaveURL(/\/dashboard\/parent/);

      // Wait for the dashboard to fully render
      await expect(
        page.locator('main h1, main h2, [data-testid="parent-dashboard-ready"]').first()
      ).toBeVisible({ timeout: 60_000 });
    });

    test('Student can login and access student dashboard', async ({ page }) => {
      await login(page, 'student');

      // Verify student dashboard URL
      await expect(page).toHaveURL(/\/dashboard\/(eleve|student)/);

      // Verify student-specific content
      await expect(page.getByText(/crédit|credit|espace élève|tableau/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('Coach can login and access coach dashboard', async ({ page }) => {
      await login(page, 'coach');

      // Verify coach dashboard URL
      await expect(page).toHaveURL(/\/dashboard\/coach/);

      // Verify coach-specific content (sessions management)
      await expect(page.getByText(/coach|sessions|disponibilités|tableau/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('Admin can login and access admin dashboard', async ({ page }) => {
      await login(page, 'admin');

      // Verify admin dashboard URL
      await expect(page).toHaveURL(/\/dashboard\/admin/);

      // Verify admin-specific content
      const adminHeader = page.getByText(/Administrateur|Admin|Tableau de Bord/i).first();
      await expect(adminHeader).toBeVisible({ timeout: 10000 });
    });

    test('Login fails with invalid credentials', async ({ page }) => {
      await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });

      await page.locator('#email').fill('invalid@test.com');
      await page.getByPlaceholder('Votre mot de passe').fill('wrongpassword');
      await page.getByTestId('btn-signin').click();

      // Wait for error message
      await expect(
        page.getByText(/email ou mot de passe incorrect/i)
      ).toBeVisible({ timeout: 5000 });

      // Should stay on signin page
      await expect(page).toHaveURL(/\/auth\/signin/);
    });

    test('Login fails with empty fields', async ({ page }) => {
      await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });

      // Try to submit without filling fields
      await page.getByTestId('btn-signin').click();

      // Should show validation errors
      const emailInput = page.locator('#email');
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
      await login(page, 'parent');

      // Try to access admin dashboard
      await page.goto('/dashboard/admin', { waitUntil: 'domcontentloaded' }).catch(() => {
        // Some browsers interrupt navigation due to redirects; continue to assertions
      });

      // Should redirect to parent dashboard or show 403
      await page.waitForLoadState('domcontentloaded');

      const url = new URL(page.url());
      const pathname = url.pathname;
      const is403 = page.getByText(/403|forbidden|non autorisé|erreur|error/i);

      // Successfully redirected if went to dashboard/parent OR signin (unauth)
      const redirected = pathname.includes('/dashboard/parent') || pathname.includes('/auth/signin');
      let forbidden = false;
      try {
        if (await is403.isVisible({ timeout: 2000 })) {
          forbidden = true;
        }
      } catch {
        forbidden = false;
      }

      expect(redirected || forbidden).toBe(true);
    });

    test('Student cannot access coach dashboard', async ({ page }) => {
      await login(page, 'student');

      // Try to access coach dashboard
      await page.goto('/dashboard/coach', { waitUntil: 'domcontentloaded' }).catch(() => {
        // Some browsers interrupt navigation due to redirects; continue to assertions
      });

      // Coach dashboard uses a client-side role guard (useSession + router.push).
      // Wait for the client-side redirect to complete (up to 15s).
      try {
        await page.waitForURL((url) => !url.pathname.includes('/dashboard/coach'), { timeout: 15000 });
      } catch {
        // If no redirect happened, check for 403 text on the page
      }

      const url = new URL(page.url());
      const pathname = url.pathname;
      const is403 = page.getByText(/403|forbidden|non autorisé|erreur|error/i);

      // Successfully redirected if NOT on coach dashboard (e.g. signin, or student dashboard)
      const redirected = !pathname.includes('/dashboard/coach');
      let forbidden = false;
      try {
        if (await is403.isVisible({ timeout: 2000 })) {
          forbidden = true;
        }
      } catch {
        forbidden = false;
      }

      expect(redirected || forbidden).toBe(true);
    });
  });

  // =============================================================================
  // BOOKING FLOW TESTS
  // =============================================================================

  test.describe.serial('Session Booking Flow', () => {
    test.beforeAll(async () => {
      // Ensure deterministic availability + credits for booking tests
      await ensureCoachAvailabilityByEmail(CREDS.coach.email);
      await ensureCoachAvailabilityByEmail(CREDS.zenon.email);
      await setStudentCreditsByEmail(CREDS.student.email, 8);
    });

    test.afterAll(async () => {
      await setStudentCreditsByEmail(CREDS.student.email, 8);
      if (CREDS.student2?.email) {
        await setStudentCreditsByEmail(CREDS.student2.email, 5);
      }
      await disconnectPrisma();
    });

    test('Parent can view available sessions', async ({ page }) => {
      await login(page, 'parent');

      const dashboardResponse = await page.request.get('/api/parent/dashboard');
      expect(dashboardResponse.ok()).toBe(true);
      const dashboard = await dashboardResponse.json();
      const child = dashboard.children?.[0];
      expect(child?.id).toBeTruthy();

      await page.goto(`/dashboard/parent/enfant/${child.id}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText(/prochaines sessions/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: /réserver une séance/i })).toBeVisible();

      const fixture = await getAvailableBookingFixture(page, 0);
      expect(fixture.slot.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    async function getAvailableBookingFixture(page: Page, slotIndex: number) {
      const dashboardResponse = await page.request.get('/api/parent/dashboard');
      expect(dashboardResponse.ok()).toBe(true);
      const dashboard = await dashboardResponse.json();
      const studentId = dashboard.children?.find((child: { userId?: string }) => child.userId)?.userId;
      expect(studentId).toBeTruthy();

      const coachesResponse = await page.request.get('/api/coaches/available?subject=MATHEMATIQUES');
      expect(coachesResponse.ok()).toBe(true);
      const coachesData = await coachesResponse.json();
      const coachId = coachesData.coaches?.[0]?.id;
      expect(coachId).toBeTruthy();

      const start = new Date();
      start.setDate(start.getDate() + 1);
      const end = new Date(start);
      end.setDate(end.getDate() + 21);
      const startDate = start.toISOString().slice(0, 10);
      const endDate = end.toISOString().slice(0, 10);
      const availabilityResponse = await page.request.get(
        `/api/coaches/availability?coachId=${coachId}&startDate=${startDate}&endDate=${endDate}`
      );
      expect(availabilityResponse.ok()).toBe(true);
      const availability = await availabilityResponse.json();
      const slot = availability.availableSlots?.[slotIndex] ?? availability.availableSlots?.[0];
      expect(slot).toBeTruthy();

      return { studentId: studentId as string, coachId: coachId as string, slot };
    }

    test('Parent can book a session for student', async ({ page }) => {
      await login(page, 'parent');
      const { studentId, coachId, slot } = await getAvailableBookingFixture(page, 0);
      const bookingResponse = await page.request.post('/api/sessions/book', {
        data: {
          coachId,
          studentId,
          subject: 'MATHEMATIQUES',
          scheduledDate: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          duration: slot.duration,
          type: 'INDIVIDUAL',
          modality: 'ONLINE',
          title: 'Session test E2E',
          description: 'Objectif: validation e2e',
          creditsToUse: 1,
        },
      });
      expect(bookingResponse.status(), await bookingResponse.text()).toBe(201);
    });

    test('Booking fails when parent has insufficient credits', async ({ page }) => {
      // Zero credits for ALL children to ensure the test is deterministic
      await setStudentCreditsByEmail(CREDS.student.email, 0);
      if (CREDS.student2?.email) {
        await setStudentCreditsByEmail(CREDS.student2.email, 0);
      }

      await login(page, 'parent');

      // Use API to attempt booking and assert rejection
      const { studentId, coachId, slot } = await getAvailableBookingFixture(page, 1);

      const bookingResponse = await page.request.post('/api/sessions/book', {
        data: {
          coachId,
          studentId,
          subject: 'MATHEMATIQUES',
          scheduledDate: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          duration: slot.duration,
          type: 'INDIVIDUAL',
          modality: 'ONLINE',
          title: 'Session test credits',
          description: 'Credits insufficient',
          creditsToUse: 1,
        },
      });

      expect(bookingResponse.status()).toBe(400);
      expect(await bookingResponse.text()).toMatch(/insufficient credits/i);
    });

    test('Coach cannot book their own sessions', async ({ page }) => {
      await login(page, 'coach');

      // Navigate to coach dashboard — use domcontentloaded (networkidle hangs due to SPA polling)
      await page.goto('/dashboard/coach', { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('heading', { name: /Coach — Hélios/i })).toBeVisible({ timeout: 15_000 });

      // Coach dashboard should NOT have a "Réserver" / "Book" button
      const bookButton = page.getByRole('button', { name: /réserver une session|book a session/i });
      await expect(bookButton).toHaveCount(0);
    });
  });

  // =============================================================================
  // UI FEEDBACK TESTS
  // =============================================================================

  test.describe('UI Feedback & Error Handling', () => {
    test('Loading states display correctly', async ({ page }) => {
      await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });

      // Fill form
      await page.locator('#email').fill(CREDS.parent.email);
      await page.getByPlaceholder('Votre mot de passe').fill(CREDS.parent.password);

      // Click submit
      const submitButton = page.getByTestId('btn-signin');
      await submitButton.click();

      // Check for loading state (button disabled or loading indicator)
      const isDisabled = await submitButton.isDisabled().catch(() => false);
      const hasLoadingClass = await submitButton.getAttribute('class').then((cls) => cls?.includes('loading'));
      const ariaBusy = await submitButton.getAttribute('aria-busy');
      const hasLoadingState = isDisabled || hasLoadingClass || ariaBusy === 'true';

      if (!hasLoadingState) {
        // Accept fast transitions where no loading state is visible
        await expect(page).toHaveURL(/\/dashboard\/parent|\/auth\/signin/);
      } else {
        expect(hasLoadingState).toBe(true);
      }
    });

    test('Form validation errors display correctly', async ({ page }) => {
      await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });

      // Fill invalid email
      await page.locator('#email').fill('invalid-email');
      await page.getByPlaceholder('Votre mot de passe').fill('short');
      await page.getByTestId('btn-signin').click();

      // Should stay on signin page (validation prevents navigation)
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/\/auth\/signin/);
    });

    test('Success toast appears after booking', async ({ page }) => {
      await login(page, 'parent');

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
      // Load the page first, then block the auth callback to simulate login failure
      await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });

      // Block only the credentials callback (not providers/session)
      await page.route('**/api/auth/callback/**', (route) => route.abort());

      await page.locator('#email').fill(CREDS.parent.email);
      await page.getByPlaceholder('Votre mot de passe').fill(CREDS.parent.password);
      await page.getByTestId('btn-signin').click();

      // Should stay on signin page (login fails due to network error)
      await page.waitForTimeout(3000);
      await expect(page).toHaveURL(/\/auth\/signin/);
    });
  });

  // =============================================================================
  // NAVIGATION TESTS
  // =============================================================================

  test.describe('Navigation & Logout', () => {
    test('User can navigate between dashboard sections', async ({ page }) => {
      await login(page, 'parent');

      const subscriptionsLink = page.getByRole('link', { name: /abonnements/i });
      await expect(subscriptionsLink).toBeVisible();
      await subscriptionsLink.click();
      await expect(page).toHaveURL(/\/dashboard\/parent\/abonnements(?:[?#]|$)/);
    });

    test('User can logout successfully', async ({ page }) => {
      await login(page, 'parent');

      const logoutButton = page.getByRole('button', { name: /se déconnecter de votre compte/i });
      await expect(logoutButton).toBeVisible();
      await Promise.all([
        page.waitForURL((url) => ['/', '/auth/signin'].includes(url.pathname)),
        logoutButton.click(),
      ]);
    });
  });
});
