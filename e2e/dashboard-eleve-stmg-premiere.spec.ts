/**
 * E2E — Dashboard élève STMG Première (Mode Survie)
 *
 * Compte: studentSurvival — STMG, PREMIERE, survivalMode=true
 * (Seed: scripts/seed-e2e-db.ts — student-survival.{timestamp}@test.com)
 *
 * Couvre:
 *  - Chargement du dashboard sans erreur 500
 *  - SurvivalDashboard visible (aria-label="Mode Survie STMG")
 *  - EleveResources, EleveBilans, EleveStages masquées (#resources/#bilans/#stages absents)
 *  - Gating API: specialties[], stmgModules×4, survivalProgress non-null, automatismes null
 *
 * Note : en mode survie, TrackContentSTMG est remplacé par SurvivalDashboard (isSurvivalMode
 * branch dans page.tsx). Les labels de modules (Mathématiques STMG, SGN…) ne sont donc pas
 * rendus côté UI — ils sont couverts par le test "gating STMG survival: payload correct".
 */
import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test.describe('Dashboard élève — STMG Première (Mode Survie)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'studentSurvival');
    await page.waitForLoadState('networkidle');
  });

  test('charge le dashboard sans erreur', async ({ page }) => {
    await expect(page).not.toHaveTitle(/500|Error/i);
    await expect(page.locator('body')).not.toContainText('Internal error');
    await expect(page.locator('body')).not.toContainText('Failed to fetch dashboard data');
  });

  test('affiche le SurvivalDashboard (Mode Survie STMG)', async ({ page }) => {
    await expect(page.getByLabel(/Mode Survie STMG/i)).toBeVisible({ timeout: 20_000 });
  });

  test('masque EleveResources, EleveBilans et EleveStages en mode survie', async ({ page }) => {
    // Les sections utilisent des id CSS définis dans les composants
    await expect(page.locator('#resources')).not.toBeVisible();
    await expect(page.locator('#bilans')).not.toBeVisible();
    await expect(page.locator('#stages')).not.toBeVisible();
  });

  test('gating STMG survival: payload correct (stmgModules×4, survivalProgress, automatismes null)', async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/student/dashboard') && r.status() === 200,
        { timeout: 20_000 }
      ),
      page.reload(),
    ]);

    const body = await response.json();
    expect(body.student.academicTrack).toBe('STMG');
    expect(body.student.survivalMode).toBe(true);
    expect(body.trackContent.specialties).toHaveLength(0);
    expect(body.trackContent.stmgModules).toHaveLength(4);
    expect(body.survivalProgress).not.toBeNull();
    expect(body.automatismes).toBeNull();
  });
});
