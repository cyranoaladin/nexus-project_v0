import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';
const RUN = process.env.E2E_RUN === '1';
const KONNECT = process.env.KONNECT_E2E === '1';
(RUN && KONNECT ? test.describe : test.describe.skip)('Payments Flow', () => {
  test('Konnect demo page renders', async ({ page }) => {
    await loginAs(page, 'parent.dupont@nexus.com');
    // Simuler une initiation de paiement pour disposer d'un paymentId
    const res = await page.request.post('/api/payments/konnect', {
      data: {
        type: 'subscription',
        key: 'HYBRIDE',
        studentId: 'dummy-student-id',
        amount: 450,
        description: 'Abonnement HYBRIDE',
      },
    });
    // Use a single CSS locator to avoid strict-mode violations across engines
    const anyHeading = page
      .locator('h1:has-text("Paiement Konnect"), h3:has-text("Simulation Paiement Konnect")')
      .first();
    if (res.ok()) {
      const data = await res.json();
      await page.goto(`/dashboard/parent/paiement/konnect-demo?paymentId=${data.paymentId}`);
      await expect(anyHeading).toBeVisible();
    } else {
      await page.goto('/dashboard/parent/paiement/konnect-demo');
      await page.waitForLoadState('networkidle');
      // Si aucun paymentId, la page peut rediriger vers abonnements côté client après hydratation
      const abonnementsHeading = page.locator('h1:text("Gestion des Abonnements")').first();
      await Promise.race([
        anyHeading.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null),
        page.waitForURL('**/dashboard/parent/abonnements', { timeout: 10000 }).catch(() => null),
      ]);
      if (page.url().includes('/dashboard/parent/abonnements')) {
        await expect(abonnementsHeading).toBeVisible({ timeout: 10000 });
      } else {
        await expect(anyHeading).toBeVisible({ timeout: 10000 });
      }
    }
  });
});
