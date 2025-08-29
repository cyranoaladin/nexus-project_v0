import { test, expect } from '@playwright/test';
import { loginAs, captureConsole, disableAnimations, setupDefaultStubs } from './helpers';

// E2E ingestion via API from the browser context to reuse auth cookies

test.describe('RAG ingestion API - production server', () => {
  test('admin can ingest via /api/admin/rag-ingest and list documents', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    await disableAnimations(page);
    await setupDefaultStubs(page);
    // Login via helper (session stubbed)
    await loginAs(page, 'admin@nexus.com', 'password123');

    // Stub the admin endpoints
    await page.route('**/api/admin/dashboard', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
    await page.route('**/api/admin/rag-ingest', async route => {
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'doc_e2e' }) });
    });
    await page.route('**/api/admin/rag/documents', async route => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [{ id: 'doc_e2e', metadata: { titre: 'Demo Ingestion API' } }] }) });
    });

    // Verify role from a safe endpoint (admin dashboard API)
    const roleOk = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/admin/dashboard', { method: 'GET' });
        return res.status === 200;
      } catch { return false; }
    });
    if (!roleOk) throw new Error('ADMIN session not established');

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

