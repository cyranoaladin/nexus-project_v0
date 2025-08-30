import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Session Booking Flow (E2E, smoke)', () => {
  test('Parent reaches booking UI via dashboard tab (E2E mode)', async ({ page }) => {
    await loginAs(page, 'parent.dupont@nexus.com', 'password123');
    await page.goto('/dashboard/parent');
    await page.waitForLoadState('networkidle');

    // Assurer que nous sommes bien sur le dashboard parent, avec quelques contournements
    if (!/\/dashboard\/parent/.test(page.url())) {
      const parentLinks = page.locator('a', { hasText: /Parent|Tableau de bord parent/i });
      if (await parentLinks.count().then((c) => c > 0)) {
        await parentLinks.first().click({ force: true });
        await page.waitForLoadState('networkidle');
      }
      if (/\/auth\/signin/.test(page.url())) {
        await loginAs(page, 'parent.dupont@nexus.com', 'password123');
        await page.goto('/dashboard/parent');
        await page.waitForLoadState('networkidle');
      }
    }

    // Attendre un élément stable du header, plus robuste que le texte
    const header = page.locator('header');
    await expect(header).toBeVisible({ timeout: 20000 });

    // Attendre un ancrage UI stable du dashboard parent
    const stable = page.getByTestId('parent-dashboard').first();
    await expect(stable).toBeVisible({ timeout: 30000 });

    // Basculer sur l'onglet "Réserver Session" (sélecteur stable via data-testid)
    const bookingTab = page.getByTestId('parent-booking-tab');
    await expect(bookingTab).toBeVisible({ timeout: 30000 });
    await bookingTab.click();

    // Valider la présence de l'UI de réservation rendue par SessionBooking (CardTitle n'est pas un heading ARIA)
    // Attendre un peu la sélection de l'enfant courant et l'injection de l'UI
    await page.waitForTimeout(500);
    const bookingHeader = page.getByText(/Réserver une Session/i);
    await expect(bookingHeader).toBeVisible({ timeout: 30000 });

    // Cross-check: la page ARIA est atteignable en mode E2E
    await page.goto('/aria');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Assistant Pédagogique ARIA')).toBeVisible({ timeout: 15000 });
  });
});
