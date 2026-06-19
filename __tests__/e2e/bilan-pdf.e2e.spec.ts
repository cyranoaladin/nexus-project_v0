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

test('Page /connexion se charge (redirection auth attendue)', async ({ page }) => {
  await page.goto('/connexion');
  await page.waitForLoadState('networkidle');
  // Must land on login/signin page or redirect — never 500
  const url = page.url();
  expect(url).toMatch(/connexion|signin|auth/i);
});

test('Page /dashboard/parent/ sans session redirige vers /connexion', async ({ page }) => {
  await page.goto('/dashboard/parent/bilans');
  await page.waitForLoadState('networkidle');
  // Should redirect to login, not show a 500 or blank page
  const url = page.url();
  expect(url).toMatch(/connexion|login|auth/i);
});

// ─── PDF endpoint returns application/pdf when authenticated ─────────────────
// (This test is skipped in CI since it needs real session credentials.
//  Run manually with PARENT_SESSION_COOKIE and a valid BILAN_ID.)

test.skip('GET /api/parent/bilans/:id/pdf retourne un PDF (authentifié)', async ({ request }) => {
  const bilanId   = process.env.E2E_BILAN_ID   ?? '';
  const sessionCookie = process.env.E2E_SESSION_COOKIE ?? '';
  if (!bilanId || !sessionCookie) test.skip();

  const res = await request.get(`/api/parent/bilans/${bilanId}/pdf`, {
    headers: { Cookie: sessionCookie },
  });

  expect(res.status()).toBe(200);
  const ct = res.headers()['content-type'];
  expect(ct).toContain('application/pdf');

  const body = await res.body();
  // PDF magic bytes: %PDF-
  expect(body.slice(0, 4).toString()).toBe('%PDF');
  expect(body.length).toBeGreaterThan(10_000); // non-empty, at least 10 KB
});
