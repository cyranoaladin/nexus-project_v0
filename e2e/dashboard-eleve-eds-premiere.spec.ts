/**
 * E2E — Dashboard élève EDS Première
 *
 * Compte: student (yasmine.dupont@test.com) — EDS_GENERALE, PREMIERE
 * Spécialités: MATHEMATIQUES, NSI, PHYSIQUE_CHIMIE
 *
 * Couvre:
 *  - Chargement du dashboard sans erreur 500
 *  - Sections présentes: cockpit, spécialités EDS
 *  - Sections absentes: survival dashboard, stmgModules
 *  - Gating API: stmgModules vide, specialties non-vide
 *  - Sous-pages accessibles (HTTP 200)
 */
import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test.describe('Dashboard élève — EDS Première', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'student');
    await page.waitForLoadState('networkidle');
  });

  test('charge le dashboard sans erreur', async ({ page }) => {
    await expect(page).not.toHaveTitle(/500|Error/i);
    await expect(page.locator('body')).not.toContainText('Internal error');
    await expect(page.locator('body')).not.toContainText('Failed to fetch dashboard data');
  });

  test('affiche les spécialités EDS (Mathématiques, NSI ou Physique-Chimie)', async ({ page }) => {
    const mathVisible = await page.getByText(/Mathématiques/i).first().isVisible().catch(() => false);
    const nsiVisible = await page.getByText(/NSI|Sciences du numérique/i).first().isVisible().catch(() => false);
    const phyVisible = await page.getByText(/Physique/i).first().isVisible().catch(() => false);
    expect(mathVisible || nsiVisible || phyVisible, 'Au moins une spécialité EDS doit être visible').toBe(true);
  });

  test("n'affiche pas le mode survie STMG", async ({ page }) => {
    await expect(page.getByLabel(/Mode Survie STMG/i)).not.toBeVisible();
    await expect(page.getByText(/Coffre des 7 réflexes/i)).not.toBeVisible();
    await expect(page.getByText(/8 phrases magiques/i)).not.toBeVisible();
  });

  test('gating EDS: stmgModules vide, specialties non-vide dans le payload', async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/student/dashboard') && r.status() === 200,
        { timeout: 20_000 }
      ),
      page.reload(),
    ]);

    const body = await response.json();
    expect(body.student.academicTrack).toBe('EDS_GENERALE');
    expect(body.student.survivalMode).toBe(false);
    expect(body.trackContent.stmgModules).toHaveLength(0);
    expect(body.trackContent.specialties.length).toBeGreaterThanOrEqual(1);
    expect(body.survivalProgress).toBeNull();
  });

  test('sous-pages accessibles (HTTP 200)', async ({ page }) => {
    for (const path of [
      '/dashboard/eleve/sessions',
      '/dashboard/eleve/mes-sessions',
      '/dashboard/eleve/ressources',
    ]) {
      const response = await page.request.get(path);
      expect(response.status(), `${path} doit retourner 200`).toBe(200);
    }
  });
});
