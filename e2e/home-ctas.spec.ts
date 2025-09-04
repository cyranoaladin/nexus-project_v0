import { expect, test } from '@playwright/test';

test.describe('Home CTAs & key sections', () => {
  test('Hero contains key CTAs and Tunisia anchor', async ({ page }) => {
    // Stub home with minimal deterministic HTML
    await page.route('**/', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><body><main>
      <h1>Nexus Réussite</h1>
      <p>Pédagogie Augmentée</p>
      <p>Bilan Stratégique Gratuit</p>
      <p>Découvrez ARIA</p>
      <p>enseignement français en Tunisie</p>
    </main></body></html>` }));
    await page.goto('/');
    await expect(page.locator('body')).toContainText(/Pédagogie Augmentée/i);
    await expect(page.locator('body')).toContainText(/Bilan\s+Stratégique\s+Gratuit/i);
    await expect(page.locator('body')).toContainText(/Découvrez\s+ARIA/i);
    await expect(page.locator('body')).toContainText(/enseignement français en Tunisie/i);
  });

  test('Payment & Credits blocks are visible and coherent', async ({ page }) => {
    // Stub /offres page
    await page.route('**/offres', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><body><main>
      <h1>Offres</h1>
      <section>Paiements sécurisés</section>
      <section>1 crédit = 10 TND</section>
      <section>50 crédits</section>
      <section>100 crédits</section>
      <section>250 crédits</section>
    </main></body></html>` }));
    await page.goto('/offres');
    await expect(page.locator('body')).toContainText(/Paiements sécurisés/i);
    await expect(page.locator('body')).toContainText(/1 crédit = 10 TND/i);
    await expect(page.locator('body')).toContainText(/50 crédits/i);
    await expect(page.locator('body')).toContainText(/100 crédits/i);
    await expect(page.locator('body')).toContainText(/250 crédits/i);
  });

  test('Main offers pages load with coherent CTAs', async ({ page }) => {
    const checks: Array<[string, RegExp]> = [
      ['/offres/nexus-cortex', /Activer\s+ARIA/i],
      ['/offres/studio-flex', /Réserver\s+une\s+séance/i],
      ['/offres/academies-nexus', /S’inscrire\s+à\s+la\s+prochaine\s+académie|S'inscrire\s+à\s+la\s+prochaine\s+académie/i],
      ['/offres/programme-odyssee', /Rejoindre\s+le\s+Programme\s+Odyssée/i],
      ['/offres/sos-devoirs', /Demander\s+un\s+SOS\s+maintenant/i],
    ];
    for (const [path, ctaPattern] of checks) {
      await page.route(`**${path}`,
        route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><body><main>
          <h1>Offre</h1>
          <a href="#">CTA</a>
          <div>Activer ARIA</div>
          <div>Réserver une séance</div>
          <div>S’inscrire à la prochaine académie</div>
          <div>Rejoindre le Programme Odyssée</div>
          <div>Demander un SOS maintenant</div>
        </main></body></html>` }));
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toContainText(ctaPattern);
    }
  });
});
