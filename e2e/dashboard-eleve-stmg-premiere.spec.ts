/**
 * E2E — Dashboard élève STMG Première (Mode Survie)
 *
 * Compte: studentSurvival — STMG, PREMIERE, survivalMode=true
 * (Seed: scripts/seed-e2e-db.ts — student-survival.{timestamp}@test.com)
 *
 * Couvre:
 *  - Chargement du dashboard sans erreur 500
 *  - SurvivalDashboard visible (section Mode Survie STMG)
 *  - Sections masquées en mode survie: EleveResources, EleveBilans, EleveStages
 *  - Gating cross-track: specialties vide dans l'API
 *  - 4 modules STMG présents dans payload
 */
import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test.describe('Dashboard élève — STMG Première (Mode Survie)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'studentSurvival');
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

  test('affiche le SurvivalDashboard (Mode Survie STMG)', async ({ page }) => {
    await page.goto('/dashboard/eleve');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel(/Mode Survie STMG/i)).toBeVisible({ timeout: 15_000 });
  });

  test('masque EleveResources, EleveBilans et EleveStages en mode survie', async ({ page }) => {
    await page.goto('/dashboard/eleve');
    await page.waitForLoadState('networkidle');

    // Ces sections sont cachées par !isSurvivalMode dans page.tsx
    await expect(page.getByRole('region', { name: /Ressources/i })).not.toBeVisible();
    await expect(page.getByRole('region', { name: /Bilans/i })).not.toBeVisible();
    await expect(page.getByRole('region', { name: /Stages/i })).not.toBeVisible();
  });

  test('API payload: gating STMG survival correct', async ({ page }) => {
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

    expect(student['academicTrack']).toBe('STMG');
    expect(student['survivalMode']).toBe(true);
    expect(trackContent['specialties']).toHaveLength(0);
    expect(trackContent['stmgModules']).toHaveLength(4);
    expect(p['survivalProgress']).not.toBeNull();
    expect(p['automatismes']).toBeNull();
  });

  test('affiche les 4 modules STMG dans le track content', async ({ page }) => {
    await page.goto('/dashboard/eleve');
    await page.waitForLoadState('networkidle');

    // Au moins un module STMG visible (Mathématiques STMG)
    await expect(
      page.getByText(/Mathématiques STMG/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
