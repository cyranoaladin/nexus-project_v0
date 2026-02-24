import { test, expect } from '@playwright/test';

/**
 * SECURITY — Admin pages must NOT be accessible without authentication.
 * If they are, this is a real security bug that must be fixed in middleware.
 */
test.describe('SECURITY — Admin pages require authentication', () => {

  test('/admin/directeur — unauthenticated should redirect to signin', async ({ page }) => {
    // Navigate as unauthenticated user
    const response = await page.goto('/admin/directeur', { waitUntil: 'domcontentloaded' });
    const status = response?.status();
    const finalUrl = page.url();

    console.log(`/admin/directeur — HTTP ${status}, final URL: ${finalUrl}`);

    // Should either redirect to signin or show access denied
    const isProtected = finalUrl.includes('/auth/signin') || finalUrl.includes('/access-required');
    
    if (!isProtected) {
      // Check if the page shows admin content (real security leak)
      const hasAdminContent = await page.getByText(/KPI|directeur|statistiques|dashboard/i).first().isVisible().catch(() => false);
      console.log(`Admin content visible without auth: ${hasAdminContent}`);
      
      if (hasAdminContent) {
        console.error('SECURITY BUG: /admin/directeur shows admin data without authentication!');
      }
    }

    // The page should redirect to signin for unauthenticated users
    expect(
      isProtected,
      `SECURITY: /admin/directeur is accessible without auth! Final URL: ${finalUrl}`
    ).toBe(true);
  });

  test('/admin/stages/fevrier-2026 — unauthenticated should redirect to signin', async ({ page }) => {
    const response = await page.goto('/admin/stages/fevrier-2026', { waitUntil: 'domcontentloaded' });
    const finalUrl = page.url();

    console.log(`/admin/stages/fevrier-2026 — final URL: ${finalUrl}`);

    const isProtected = finalUrl.includes('/auth/signin') || finalUrl.includes('/access-required');

    if (!isProtected) {
      const hasAdminContent = await page.getByText(/réservation|stage|admin/i).first().isVisible().catch(() => false);
      console.log(`Admin stages content visible without auth: ${hasAdminContent}`);
    }

    expect(
      isProtected,
      `SECURITY: /admin/stages/fevrier-2026 is accessible without auth! Final URL: ${finalUrl}`
    ).toBe(true);
  });
});
