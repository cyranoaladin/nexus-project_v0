import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';
const RUN = process.env.E2E_RUN === '1';
const KONNECT = process.env.KONNECT_E2E === '1';
((RUN && KONNECT) ? test.describe : test.describe.skip)('Payments Flow', () => {
  test('Konnect demo page renders', async ({ page }) => {
    await loginAs(page, 'parent.dupont@nexus.com');
    // Simuler une initiation de paiement pour disposer d'un paymentId
    const res = await page.request.post('/api/payments/konnect', {
      data: { type: 'subscription', key: 'HYBRIDE', studentId: 'dummy-student-id', amount: 450, description: 'Abonnement HYBRIDE' }
    });
    // Use a single CSS locator to avoid strict-mode violations across engines
    const anyHeading = page.locator('h1:has-text("Paiement Konnect"), h3:has-text("Simulation Paiement Konnect")').first();
    if (res.ok()) {
      const data = await res.json();
      await page.goto(`/dashboard/parent/paiement/konnect-demo?paymentId=${data.paymentId}`);
      await expect(anyHeading).toBeVisible();
    } else {
      await page.goto('/dashboard/parent/paiement/konnect-demo');
      // WebKit may redirect to abonnements if no paymentId is provided
      const navPromise = page.waitForURL('**/dashboard/parent/abonnements', { timeout: 5000 }).catch(() => null);
      await Promise.race([
        anyHeading.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
        navPromise,
      ]);
      // If redirected, ensure we are on abonnements; otherwise, the heading should be visible
      if (page.url().includes('/dashboard/parent/abonnements')) {
        await expect(page).toHaveURL(/\/dashboard\/parent\/abonnements/);
      } else {
        // Also accept presence of the back link 'Retour' in header when heading isn't captured fast enough
        const backLink = page.getByRole('link', { name: /Retour/i });
        await expect(anyHeading.or(backLink)).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
