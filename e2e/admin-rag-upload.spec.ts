import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Admin RAG Upload', () => {
  test('parse metadata and ingest document', async ({ page, browserName, context }) => {
    await loginAs(page, 'admin@nexus.com');
    await page.goto('/dashboard/admin/rag-management');
    try { await page.waitForURL('**/dashboard/admin/rag-management', { timeout: 15000 }); } catch {}
    await page.waitForLoadState('networkidle');
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
    // Attacher le fichier même si l'input n'est pas visible sur WebKit
    await page.waitForSelector('[data-testid="rag-file-upload"]', { state: 'attached', timeout: 30000 });
    // Safari: l'input file peut être masqué; setInputFiles fonctionne quand même si l'élément est attaché
    await page.setInputFiles('[data-testid="rag-file-upload"]', {
      name: 'suites.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(mdContent, 'utf-8')
    });

    await page.getByTestId('rag-analyse').click();

    await expect(page.getByTestId('rag-meta-titre')).toHaveValue('Suites numériques');
    await expect(page.getByTestId('rag-meta-matiere')).toHaveValue('Mathématiques');
    await expect(page.getByTestId('rag-meta-niveau')).toHaveValue('Terminale');

    // Stub the admin ingest API to succeed
    await page.route('**/api/admin/rag-ingest', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'doc-xyz' }) });
    });

    // Attendre que le message de succès (Alert) apparaisse après ingestion
    await page.getByTestId('rag-ingest').click();
    const successAlert = page.locator('text=Succès').first();
    await expect(successAlert).toBeVisible({ timeout: 15000 });
  });
});
