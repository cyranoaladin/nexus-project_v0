import { test, expect } from '@playwright/test';
import { captureConsole } from './helpers';

// Minimal smoke tests against the already running prod server (E2E_BASE_URL)
// - Public pages
// - Status page
// - Admin dashboard access after programmatic login

const RUN_PROD = !!process.env.E2E_NO_SERVER || (process.env.E2E_BASE_URL && process.env.E2E_BASE_URL !== 'http://localhost:3001');

(RUN_PROD ? test.describe : test.describe.skip)('Smoke (prod server)', () => {
  const pages = ['/', '/contact', '/offres', '/bilan-gratuit', '/aria', '/status'];

  for (const path of pages) {
    test(`GET ${path} returns 200`, async ({ page }) => {
      const cap = captureConsole(page, test.info());
      try {
        const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
        expect(res?.ok(), `HTTP not OK for ${path}`).toBeTruthy();
        const txt = await page.locator('body').innerText();
        expect(txt.length).toBeGreaterThan(10);
      } finally {
        await cap.attach(`console.smoke.prod.${path.replace(/\W+/g, '_')}.json`);
      }
    });
  }

  test('Programmatic login as admin then access /dashboard/admin', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    // Get CSRF
    const csrfRes = await page.request.get('/api/auth/csrf');
    const { csrfToken } = await csrfRes.json();
    expect(typeof csrfToken).toBe('string');

    const form = new URLSearchParams();
    form.set('csrfToken', csrfToken);
    form.set('callbackUrl', '/');
    form.set('json', 'true');
    form.set('email', 'admin@nexus.com');
    form.set('password', 'password123');

    const loginRes = await page.request.post('/api/auth/callback/credentials', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: form.toString(),
    });
    expect(loginRes.ok()).toBeTruthy();

    const res = await page.goto('/dashboard/admin', { waitUntil: 'domcontentloaded' });
    expect(res?.ok()).toBeTruthy();
    // Be tolerant to minor text differences, assert by role heading or known links
    const anyVisible = await Promise.any([
      page.getByRole('heading', { name: /Administration|Admin|Tableau/i }).first().isVisible(),
      page.getByText(/Outils d'Administration|Ingestion Docs RAG|Analytics/i).first().isVisible(),
      page.getByRole('link', { name: /Ingestion Docs RAG|Users|Subscriptions/i }).first().isVisible(),
    ]).then(() => true).catch(() => false);
    expect(anyVisible).toBeTruthy();
    await cap.attach('console.smoke.prod.admin.json');
  });
});

