import { test, expect } from '@playwright/test';
import { loginAs, captureConsole } from './helpers';

// E2E ingestion via API from the browser context to reuse auth cookies

const SKIP_RAG = !process.env.OPENAI_API_KEY;

test.describe('RAG ingestion API - production server', () => {
  test.skip(SKIP_RAG, 'Skipping RAG ingestion tests: OPENAI_API_KEY not set');
  test('admin can ingest via /api/admin/rag-ingest and list documents', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    // Ensure authenticated ADMIN session (programmatic credentials sign-in)
    // 1) Fetch CSRF token
    const csrfRes = await page.request.get('/api/auth/csrf');
    const csrfJson = await csrfRes.json();
    const csrfToken: string | undefined = csrfJson?.csrfToken;

    if (!csrfToken) throw new Error('Could not retrieve CSRF token');

    // 2) Post credentials to next-auth callback (sets session cookie)
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
    if (!loginRes.ok()) {
      throw new Error(`Credentials sign-in failed: ${loginRes.status()} ${await loginRes.text()}`);
    }

    // 3) Navigate to admin dashboard to ensure session applies in page context
    try { await page.goto('/dashboard/admin', { waitUntil: 'domcontentloaded' }); } catch {}
    await page.waitForLoadState('domcontentloaded');

    // Verify role from a safe endpoint (admin dashboard API)
    const roleOk = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/admin/dashboard', { method: 'GET' });
        return res.status === 200;
      } catch { return false; }
    });
    if (!roleOk) {
      // Final attempt to assert we’re logged as admin
      throw new Error('ADMIN session not established');
    }

    // Prepare payload
    const contenu = 'Ceci est un test E2E ingestion API.';
    const metadata = {
      titre: 'Demo Ingestion API',
      matiere: 'MATHEMATIQUES',
      niveau: 'Terminale',
      mots_cles: ['api', 'e2e']
    };

    // Call the API from within the page (cookies/session included)
    const postResult = await page.evaluate(async ({ contenu, metadata }) => {
      const res = await fetch('/api/admin/rag-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenu, metadata }),
      });
      const text = await res.text();
      return { status: res.status, text };
    }, { contenu, metadata });

    // If 403 due to intermittent auth cookie timing, retry once
    if (postResult.status === 403) {
      await page.waitForTimeout(500);
      const again = await page.evaluate(async ({ contenu, metadata }) => {
        const res = await fetch('/api/admin/rag-ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contenu, metadata }),
        });
        const text = await res.text();
        return { status: res.status, text };
      }, { contenu, metadata });
      postResult.status = again.status;
      postResult.text = again.text;
    }

    expect(postResult.status).toBe(201);
    let id: string | undefined;
    try { id = JSON.parse(postResult.text).id; } catch {}
    expect(typeof id).toBe('string');

    // Verify listing endpoint sees the new document
    const listResult = await page.evaluate(async () => {
      const res = await fetch('/api/admin/rag/documents', { method: 'GET', headers: { 'cache-control': 'no-store' } });
      const text = await res.text();
      return { status: res.status, text };
    });
    expect(listResult.status).toBe(200);
    let docs: any[] = [];
    try { docs = JSON.parse(listResult.text).documents || []; } catch {}
    const hasDemo = docs.some(d => (d?.metadata?.titre || '').includes('Demo Ingestion'));
    expect(hasDemo).toBeTruthy();
    await cap.attach('console.admin.rag.ingest.api.json');
  });
});

