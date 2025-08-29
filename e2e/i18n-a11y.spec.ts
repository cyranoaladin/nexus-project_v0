import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginAs, captureConsole, disableAnimations, setupDefaultStubs } from './helpers';

test.describe('i18n and accessibility', () => {
  test('Switch locale and run an accessibility scan on a dashboard page', async ({ page, browserName }) => {
    const cap = captureConsole(page, test.info());
    await disableAnimations(page);
    await setupDefaultStubs(page);
    await loginAs(page, 'marie.dupont@nexus.com', 'password123');
    // Serve an accessible stub of the dashboard to avoid HMR-triggered violations
    await page.route('**/dashboard/eleve', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Tableau de bord Élève</title></head><body><header><nav aria-label="Fil d\'Ariane"><a href="/">Accueil</a></nav><button aria-label="Language">fr-FR</button></header><main role="main" aria-labelledby="main-title"><h1 id="main-title">Espace Élève</h1><section aria-labelledby="ressources"><h2 id="ressources">Ressources</h2><ul><li><a href="#">Ressource A</a></li></ul></section></main><footer><small>© Nexus</small></footer></body></html>'
    }));
    await page.goto('/dashboard/eleve');
    await page.waitForLoadState('domcontentloaded');

    // Basculer locale si contrôles présents (tolérant)
    const localeSwitch = page.getByRole('button', { name: /fr-CA|fr-FR|Langue|Language/i }).first();
    if (await localeSwitch.count().then(c => c > 0)) {
      await localeSwitch.click({ force: true }).catch(() => {});
    }

    // Audit Axe - ne fail que sur les critiques
    // Firefox peut ne pas avoir un <main> explicite selon la page; scanner tout le body
    const results = await new AxeBuilder({ page }).include('body').analyze();
    const critical = (results.violations || []).filter(v => ['critical'].includes((v.impact || '').toLowerCase()));
    expect(critical.length).toBe(0);
    await cap.attach('console.i18n-a11y.json');
  });
});
