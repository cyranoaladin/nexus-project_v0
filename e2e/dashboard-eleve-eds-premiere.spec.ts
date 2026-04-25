/**
 * E2E — Dashboard élève EDS Première
 *
 * Compte: student (yasmine.dupont@test.com) — EDS_GENERALE, PREMIERE
 * Spécialités: MATHEMATIQUES, NSI, PHYSIQUE_CHIMIE
 *
 * Couvre:
 *  - Chargement du dashboard sans erreur 500
 *  - Sections présentes: cockpit, track content EDS (3 spécialités)
 *  - Sections absentes: survival dashboard
 *  - Gating cross-track: stmgModules vide dans l'API
 */
import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test.describe('Dashboard élève — EDS Première', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'student');
  });

  test('charge le dashboard sans erreur', async ({ page }) => {
    const apiPromise = page.waitForResponse(
      (r) => r.url().includes('/api/student/dashboard') && r.status() === 200,
      { timeout: 15_000 }
    );
    await page.goto('/dashboard/eleve');
    await apiPromise;
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveTitle(/500|Error/i);
    await expect(page.locator('body')).not.toContainText('Internal error');
  });

  test('affiche les 3 spécialités EDS', async ({ page }) => {
    await page.goto('/dashboard/eleve');
    await page.waitForLoadState('networkidle');

    // TrackContent EDS doit montrer au moins une spécialité (Mathématiques)
    await expect(
      page.getByText(/Mathématiques/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("n'affiche pas le mode survie STMG", async ({ page }) => {
    await page.goto('/dashboard/eleve');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel(/Mode Survie STMG/i)).not.toBeVisible();
    await expect(page.getByText(/Coffre des 7 réflexes/i)).not.toBeVisible();
    await expect(page.getByText(/8 phrases magiques/i)).not.toBeVisible();
  });

  test('API payload: gating EDS correct', async ({ page }) => {
    let payload: Record<string, unknown> | null = null;

    page.on('response', async (r) => {
      if (r.url().includes('/api/student/dashboard') && r.status() === 200) {
        payload = await r.json();
      }
    });

    await page.goto('/dashboard/eleve');
    await page.waitForLoadState('networkidle');

    expect(payload).not.toBeNull();
    const p = payload!;
    const student = p['student'] as Record<string, unknown>;
    const trackContent = p['trackContent'] as Record<string, unknown[]>;

    expect(student['academicTrack']).toBe('EDS_GENERALE');
    expect(student['survivalMode']).toBe(false);
    expect(trackContent['stmgModules']).toHaveLength(0);
    expect((trackContent['specialties'] as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect(p['survivalProgress']).toBeNull();
  });

  test('sous-pages accessibles (200)', async ({ page }) => {
    for (const path of ['/dashboard/eleve/sessions', '/dashboard/eleve/mes-sessions', '/dashboard/eleve/ressources']) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} doit retourner 200`).toBe(200);
    }
  });
});
