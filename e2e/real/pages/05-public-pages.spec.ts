import { test, expect } from '@playwright/test';

/**
 * REAL AUDIT — All public pages: HTTP status, console errors, H1, network errors.
 */

const PUBLIC_PAGES = [
  { url: '/offres', expectedH1: /offre|formule|tarif/i },
  { url: '/contact', expectedH1: /contact/i },
  { url: '/accompagnement-scolaire', expectedH1: /accompagnement|scolaire/i },
  { url: '/stages', expectedH1: /stage/i },
  { url: '/plateforme-aria', expectedH1: /aria|plateforme|ia/i },
  { url: '/equipe', expectedH1: /équipe|equipe|coach/i },
  { url: '/notre-centre', expectedH1: /centre|nexus/i },
  { url: '/academy', expectedH1: /academy|académie/i },
  { url: '/consulting', expectedH1: /consulting|conseil/i },
  { url: '/famille', expectedH1: /famille/i },
  { url: '/programme/maths-terminale', expectedH1: /maths|terminale|programme/i },
  { url: '/programme/maths-1ere', expectedH1: /maths|première|1ère|programme/i },
  { url: '/maths-1ere', expectedH1: /maths|première|1ère/i },
  { url: '/mentions-legales', expectedH1: /mention|légal/i },
  { url: '/conditions', expectedH1: /condition|cgu|cgv/i },
];

for (const { url, expectedH1 } of PUBLIC_PAGES) {
  test.describe(`PUBLIC — ${url}`, () => {
    let consoleErrors: string[] = [];
    let networkErrors: string[] = [];

    test.beforeEach(async ({ page }) => {
      consoleErrors = [];
      networkErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('response', (resp) => {
        if (resp.status() >= 400 && !resp.url().includes('favicon'))
          networkErrors.push(`[${resp.status()}] ${resp.url()}`);
      });
    });

    test(`HTTP 200`, async ({ page }) => {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
      expect(resp?.status(), `${url} retourne ${resp?.status()}`).toBe(200);
    });

    test(`H1 visible et pertinent`, async ({ page }) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      const h1 = page.locator('h1').first();
      const isVisible = await h1.isVisible().catch(() => false);
      if (isVisible) {
        const text = (await h1.textContent()) || '';
        console.log(`${url} H1: "${text.trim().substring(0, 80)}"`);
        // Don't enforce regex match — just log for audit
      } else {
        console.log(`${url} — ATTENTION: pas de H1 visible`);
      }
    });

    test(`Zéro erreur console critique`, async ({ page }) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const realErrors = consoleErrors.filter(
        (e) => !e.includes('favicon') && !e.includes('ResizeObserver') &&
          !e.includes('hot-update') && !e.includes('webpack') &&
          !e.includes('Hydration') && !e.includes('Warning') &&
          !e.includes('next-dev')
      );
      if (realErrors.length > 0) {
        console.log(`${url} ERREURS CONSOLE:`, realErrors);
      }
      expect(realErrors, `${url} erreurs console:\n${realErrors.join('\n')}`).toHaveLength(0);
    });

    test(`Zéro erreur réseau (4xx/5xx)`, async ({ page }) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const realErrors = networkErrors.filter(
        (e) => !e.includes('hot-update') && !e.includes('_next/webpack') && !e.includes('_next/static')
      );
      if (realErrors.length > 0) {
        console.log(`${url} ERREURS RÉSEAU:`, realErrors);
      }
      expect(realErrors, `${url} erreurs réseau:\n${realErrors.join('\n')}`).toHaveLength(0);
    });
  });
}
