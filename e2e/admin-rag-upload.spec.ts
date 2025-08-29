import { expect, test } from '@playwright/test';
import { loginAs, captureConsole } from './helpers';

test.describe('Admin RAG Upload', () => {
  test('parse metadata and ingest document', async ({ page, browserName, context }) => {
    const cap = captureConsole(page, test.info());
    await loginAs(page, 'admin@nexus.com');
    try { await page.goto('/dashboard/admin/rag-management', { waitUntil: 'domcontentloaded' }); } catch {}
    try { await page.waitForURL('**/dashboard/admin/rag-management', { timeout: 15000 }); } catch {}
    await page.waitForLoadState('domcontentloaded');

    // Assurer que nous sommes bien sur la page de gestion RAG
    const pageReady = await page.getByText(/Ingestion de Documents|Base de Connaissances Actuelle/i).first().isVisible().catch(() => false);
    if (!pageReady) {
      if (/\/auth\/signin/.test(page.url())) {
        await loginAs(page, 'admin@nexus.com');
        try { await page.goto('/dashboard/admin/rag-management', { waitUntil: 'domcontentloaded' }); } catch {}
        await page.waitForLoadState('domcontentloaded');
      }
    }

    // Page ready when uploader input attaches

    // Create a temporary .md file in-memory via filechooser
    const mdContent = `---\n` +
      `titre: Suites numériques\n` +
      `matiere: Mathématiques\n` +
      `niveau: Terminale\n` +
      `mots_cles: [suites, récurrence]\n` +
      `---\n\n# Cours sur les suites\n` +
      `Contenu principal.`;

    await page.waitForTimeout(800);
    // Attacher le fichier même si l'input n'est pas visible
    const fileInput = page.getByTestId('rag-file-upload');
    await fileInput.waitFor({ state: 'attached', timeout: 30000 }).catch(async () => {
      // Dernier essai: recharger la page RAG
      try { await page.goto('/dashboard/admin/rag-management', { waitUntil: 'domcontentloaded' }); } catch {}
      await page.waitForLoadState('domcontentloaded');
      await fileInput.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
    });
    // Safari/Firefox: l'input file peut être masqué; setInputFiles fonctionne quand même si attaché
    await page.setInputFiles('[data-testid="rag-file-upload"]', {
      name: 'suites.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(mdContent, 'utf-8')
    });

    // Donner plus de temps à l'analyse de métadonnées côté client
    await expect(page.getByTestId('rag-analyse')).toBeEnabled({ timeout: 30000 });
    await page.getByTestId('rag-analyse').click();

    await expect(page.getByTestId('rag-meta-titre')).toHaveValue('Suites numériques');
    await expect(page.getByTestId('rag-meta-matiere')).toHaveValue('Mathématiques');
    await expect(page.getByTestId('rag-meta-niveau')).toHaveValue('Terminale');

    // Stub the admin ingest API to succeed
    await page.route('**/api/admin/rag-ingest', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'doc-xyz' }) });
    });

    await page.getByTestId('rag-ingest').click();
    await expect(page.getByText('Document ingéré avec succès')).toBeVisible();
    await cap.attach('console.admin.rag.upload.json');
  });
});
