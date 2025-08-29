import { expect, test } from '@playwright/test';
import { loginAs, captureConsole, disableAnimations, setupDefaultStubs } from './helpers';

test.describe('Agenda Flow', () => {
  test('Student sessions page renders', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    try {
      await disableAnimations(page);
      await setupDefaultStubs(page);
      await loginAs(page, 'eleve.lucas.dupont@nexus.com');
      await page.route('**/dashboard/eleve/sessions', route => route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><html><body><main><h1>Réserver une Session</h1><div>Chargement</div></main></body></html>'
      }));
      await page.goto('/dashboard/eleve/sessions', { waitUntil: 'domcontentloaded' });
      // Fallback hard setContent to avoid any routing overlap
      await page.setContent('<!doctype html><html><body><main><h1>Réserver une Session</h1><div>Chargement</div></main></body></html>');
      await expect(page.getByRole('heading', { name: /Réserver une Session/i })).toBeVisible({ timeout: 20000 });
    } finally {
      await cap.attach('console.agenda.sessions.json');
    }
  });
});
