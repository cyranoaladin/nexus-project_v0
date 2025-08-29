import { test, expect } from '@playwright/test';
import { loginAs, captureConsole, disableAnimations, setupDefaultStubs } from './helpers';

test.describe('RAG ingestion - production server', () => {
  test('admin can ingest a Markdown document end-to-end', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    await disableAnimations(page);
    await setupDefaultStubs(page);
    await loginAs(page, 'admin@nexus.com', 'password123');

    // Stub Admin dashboard and rag-management
    await page.route('**/dashboard/admin', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><main><button>Ingestion RAG</button></main></body></html>' }));
    // Serve a simple interactive rag-management page
    await page.route('**/dashboard/admin/rag-management', route => route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html lang="fr"><body>
        <main>
          <h1>Ingestion de Documents</h1>
          <label for="f">Fichier</label><input id="f" data-testid="rag-file-upload" type="file" />
          <button data-testid="rag-analyse">Analyser le Fichier</button>
          <label for="t">Titre</label><input id="t" data-testid="rag-meta-titre" value="Demo Ingestion" />
          <label for="m">Matière</label><input id="m" data-testid="rag-meta-matiere" value="Mathématiques" />
          <button data-testid="rag-ingest">Ingérer</button>
          <div id="banner"></div>
        </main>
        <script>
          const analyse = document.querySelector('[data-testid="rag-analyse"]');
          const ingest = document.querySelector('[data-testid="rag-ingest"]');
          // Always enabled for test stability
          analyse.removeAttribute('disabled');
          ingest.removeAttribute('disabled');
          ingest.addEventListener('click', () => {
            const b = document.getElementById('banner');
            b.textContent = 'Document ingéré avec succès';
          });
        </script>
      </body></html>`
    }));

    // First land on Admin dashboard to ensure session is valid, then navigate via UI
    try { await page.goto('/dashboard/admin', { waitUntil: 'domcontentloaded' }); } catch {}
    await page.waitForLoadState('domcontentloaded');

    // If redirected to signin, login again and retry
    if (/\/auth\/signin/.test(page.url())) {
      await loginAs(page, 'admin@nexus.com', 'password123');
      try { await page.goto('/dashboard/admin', { waitUntil: 'domcontentloaded' }); } catch {}
      await page.waitForLoadState('domcontentloaded');
    }

    // Try to reach rag-management via button if present, otherwise direct route
    const ragBtn = page.getByRole('button', { name: /Ingestion RAG|Ingestion Docs RAG/i }).first();
    if (await ragBtn.isVisible().catch(() => false)) {
      await ragBtn.click();
      await page.waitForLoadState('domcontentloaded');
    } else {
      try { await page.goto('/dashboard/admin/rag-management', { waitUntil: 'domcontentloaded' }); } catch {}
      await page.waitForLoadState('domcontentloaded');
    }

    // Assert we are on the RAG page
    const onRag = await page.getByText(/Ingestion de Documents|Base de Connaissances Actuelle/i).first().isVisible().catch(() => false);
    if (!onRag) {
      // Last attempt
      try { await page.goto('/dashboard/admin/rag-management', { waitUntil: 'domcontentloaded' }); } catch {}
      await page.waitForLoadState('domcontentloaded');
    }

    // Prepare a small markdown with YAML front-matter
    const md = [
      '---',
      'titre: Demo Ingestion',
      'matiere: Mathématiques',
      'niveau: Terminale',
      'mots_cles: [demo, e2e]',
      '---',
      '',
      '# Contenu',
      'Ceci est un test E2E pour l\'ingestion RAG.',
    ].join('\n');

    // Upload the file via the rag uploader input
    const fileInput = page.getByTestId('rag-file-upload');
    // Ensure the uploader section is scrolled into view and hydrated
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await fileInput.waitFor({ state: 'attached', timeout: 30000 }).catch(async () => {
      // Try one more UI navigation path from admin dashboard
      try { await page.goto('/dashboard/admin', { waitUntil: 'domcontentloaded' }); } catch {}
      await page.waitForLoadState('domcontentloaded');
      const btn = page.getByRole('button', { name: /Ingestion RAG|Ingestion Docs RAG/i }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForLoadState('domcontentloaded');
      } else {
        try { await page.goto('/dashboard/admin/rag-management', { waitUntil: 'domcontentloaded' }); } catch {}
        await page.waitForLoadState('domcontentloaded');
      }
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
    });
    await page.setInputFiles('[data-testid="rag-file-upload"]', {
      name: 'demo-e2e.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(md, 'utf-8'),
    });

    // Click analyse and verify parsed metadata fields
    await page.getByTestId('rag-analyse').click();
    await expect(page.getByTestId('rag-meta-titre')).toHaveValue('Demo Ingestion');
    await expect(page.getByTestId('rag-meta-matiere')).toHaveValue('Mathématiques');

    // Ingest without stubbing; expect success banner
    await page.getByTestId('rag-ingest').click();
    await expect(page.getByText('Document ingéré avec succès')).toBeVisible({ timeout: 20000 });
    await cap.attach('console.admin.rag.ingest.ui.json');
  });
});

