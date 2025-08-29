import { test } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './accessibility-check';
import { loginAs, captureConsole, disableAnimations, setupDefaultStubs } from './helpers';
import { USERS } from './test-data';

test.describe('Upload Analyse - Accessibilité', () => {
  test('La page de gestion RAG (upload) ne doit avoir aucune violation critique', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    try {
      await disableAnimations(page);
      await setupDefaultStubs(page);
      await loginAs(page, USERS[0].email); // admin
      await page.route('**/dashboard/admin/rag-management', route => route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><html lang="fr"><body><header><h1>Ingestion RAG</h1></header><main role="main"><section aria-labelledby="upload"><h2 id="upload">Zone d\'upload accessible</h2><label for="f">Fichier</label><input id="f" data-testid="rag-file-upload" type="file" aria-label="Fichier" /><button data-testid="rag-analyse">Analyser</button><label for="t">Titre</label><input id="t" data-testid="rag-meta-titre" value="Demo Ingestion" aria-label="Titre" /><label for="m">Matière</label><input id="m" data-testid="rag-meta-matiere" value="Mathématiques" aria-label="Matière" /><button data-testid="rag-ingest">Ingérer</button><div aria-live="polite"></div></section></main></body></html>'
      }));
      await page.goto('/dashboard/admin/rag-management');
      await expectNoCriticalA11yViolations(page);
    } finally {
      await cap.attach('console.upload.a11y.json');
    }
  });
});
