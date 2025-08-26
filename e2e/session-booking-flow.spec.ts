import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Session Booking Flow (E2E, smoke)', () => {
  test('Parent reaches booking UI via dashboard tab (E2E mode)', async ({ page }) => {
    await loginAs(page, 'parent.dupont@nexus.com', 'password123');
    await page.goto('/dashboard/parent');
    await page.waitForLoadState('networkidle');
    // Attendre un élément stable du header, plus robuste que le texte
    const header = page.locator('header');
    await expect(header).toBeVisible({ timeout: 20000 });

    // Basculer sur l'onglet "Réserver Session"
    const bookingTab = page.getByRole('button', { name: /Réserver Session/i }).first();
    await expect(bookingTab).toBeVisible({ timeout: 20000 });
    await bookingTab.click();

    // Valider la présence de l'UI de réservation rendue par SessionBooking
    await expect(page.getByRole('heading', { name: /Réserver une Session/i })).toBeVisible({
      timeout: 20000,
    });

    // Cross-check: la page ARIA est atteignable en mode E2E
    await page.goto('/aria');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Assistant Pédagogique ARIA')).toBeVisible({ timeout: 15000 });
  });
});
