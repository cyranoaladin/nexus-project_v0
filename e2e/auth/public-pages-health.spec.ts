/**
 * Sante des pages publiques.
 *
 * Reecriture de `test-all-pages.spec.ts`, qui melangeait un invariant utile et
 * un outil d'audit : il ecrivait des captures et un rapport JSON dans /tmp,
 * journalisait un resume, et n'exposait qu'une seule assertion agregee pour
 * quatorze pages — un echec ne disait pas laquelle.
 *
 * L'invariant est conserve et rendu exploitable : une page, un test. Les
 * artefacts hors depot sont supprimes ; en cas d'echec, Playwright produit deja
 * trace et capture.
 */
import { test, expect } from '@playwright/test';

/** Pages publiques servies sans authentification. */
const PUBLIC_PAGES = [
  '/', '/offres', '/bilan-gratuit', '/contact', '/stages',
  '/bilan-pallier2-maths', '/programme/maths-1ere',
  '/accompagnement-scolaire', '/plateforme-aria',
  '/equipe', '/notre-centre', '/conditions', '/mentions-legales',
  '/auth/signin',
] as const;

for (const url of PUBLIC_PAGES) {
  test(`page publique ${url} : 200, sans erreur console ni requête en échec`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      // Le favicon manquant est une nuisance de developpement, pas un defaut
      // de la page : il ne dit rien de ce que l'utilisateur peut faire.
      if (text.includes('favicon')) return;
      consoleErrors.push(text.slice(0, 200));
    });
    page.on('response', (response) => {
      const status = response.status();
      if (status < 400) return;
      const target = response.url();
      if (target.includes('favicon') || target.includes('/_next/')) return;
      failedRequests.push(`[${status}] ${target.slice(0, 120)}`);
    });

    const response = await page.goto(url, { waitUntil: 'load', timeout: 20_000 });
    expect(response?.status(), `${url} doit répondre 200`).toBe(200);

    // Laisse aux appels differes le temps de se manifester : une page peut
    // repondre 200 puis echouer sur une ressource qu'elle charge ensuite.
    await page.waitForTimeout(500);

    expect(consoleErrors, `${url} : aucune erreur console`).toEqual([]);
    expect(failedRequests, `${url} : aucune requête en échec`).toEqual([]);
  });
}
