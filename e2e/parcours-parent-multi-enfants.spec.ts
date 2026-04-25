/**
 * Phase 8 — Parcours parent multi-enfants
 *
 * La seed E2E (`scripts/seed-e2e-db.ts`) attache deux élèves au parent
 * (`student@example.com` et `student2@example.com`) via le même
 * `parentProfile.id`. Cette spec vérifie que :
 *   - le parent voit la liste de ses enfants sur `/dashboard/parent`
 *   - l'API `/api/parent/dashboard` renvoie bien `children` avec ≥ 2 entrées
 *   - le drill-down par enfant `/dashboard/parent/enfant/[studentId]`
 *     répond 200 ou 3xx (pas 5xx) — la route a été réparée Phase 8 (typo
 *     [studentId/] → [studentId]).
 */
import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test.describe('Parcours parent multi-enfants', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'parent');
  });

  test('arrive sur /dashboard/parent et l’API renvoie ≥ 2 enfants', async ({ page }) => {
    await page.goto('/dashboard/parent');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/dashboard/parent');

    const response = await page.request.get('/api/parent/dashboard');
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(Array.isArray(json.children)).toBeTruthy();
    expect(json.children.length).toBeGreaterThanOrEqual(2);
  });

  test('le drill-down /dashboard/parent/enfant/[studentId] répond sans 5xx', async ({ page }) => {
    const apiResponse = await page.request.get('/api/parent/dashboard');
    expect(apiResponse.ok()).toBeTruthy();
    const json = await apiResponse.json();
    const firstChildId = json.children?.[0]?.id;
    expect(firstChildId).toBeTruthy();

    const response = await page.goto(`/dashboard/parent/enfant/${firstChildId}`);
    await page.waitForLoadState('networkidle');
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
    // L'URL doit rester sous /dashboard/parent
    expect(page.url()).toContain('/dashboard/parent');
  });
});
