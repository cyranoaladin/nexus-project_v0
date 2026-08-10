/**
 * E2E smoke tests — Bilan PDF download (parent dashboard)
 *
 * These tests run against the live app (BASE_URL).
 * Auth-gated routes are tested at the HTTP level (401 shape) since
 * we don't provision real parent sessions in CI/e2e.
 * The healthcheck + page-load tests require no credentials.
 */

import { expect, test } from '@playwright/test';

// ─── Health & infra ───────────────────────────────────────────────────────────

test('API /api/health répond 200 avec {ok:true}', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok ?? body.status).toBeTruthy();
});

// ─── Auth guard on PDF endpoint ───────────────────────────────────────────────

test('GET /api/parent/bilans/xxx/pdf sans session → 401 (pas 500)', async ({ request }) => {
  const res = await request.get('/api/parent/bilans/nonexistent-id/pdf');
  // Must be an auth error, never an internal error
  expect(res.status()).toBeGreaterThanOrEqual(401);
  expect(res.status()).toBeLessThan(500);
});

test('GET /api/parent/bilans/xxx/pdf Content-Type est json pour 401', async ({ request }) => {
  const res = await request.get('/api/parent/bilans/nonexistent-id/pdf');
  const ct = res.headers()['content-type'] ?? '';
  expect(ct).toContain('application/json');
});

// ─── Public pages reachable ───────────────────────────────────────────────────

test('Page canonique de connexion se charge', async ({ page }) => {
  const response = await page.goto('/auth/signin');
  await page.waitForLoadState('domcontentloaded');
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId('input-email')).toBeVisible();
  await expect(page.getByTestId('input-password')).toBeVisible();
});

test('Page /dashboard/parent/ sans session redirige vers la connexion canonique', async ({ page }) => {
  await page.goto('/dashboard/parent/bilans');
  await page.waitForLoadState('domcontentloaded');
  // Should redirect to login, not show a 500 or blank page
  const url = page.url();
  expect(url).toMatch(/connexion|login|auth/i);
});

// Le PDF authentifié (canonique et URL legacy) est exercé avec une vraie
// session et une vraie fixture dans parent-canonical-report-access.spec.ts.
