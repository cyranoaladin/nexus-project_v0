import { expect, test } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3003';

// Assertions souples basées sur contenus_site_v_2.md
const EXPECTS = [
  // Hero
  /pédagogie/i,
  /Bilan\s+Stratégique\s+Gratuit/i,
  /Découvrez\s+ARIA/i,
  // Paiements
  /Paiement\s+en\s+ligne\s+sécurisé/i,
  /(CB|carte)\b/i,
  /Virement/i,
  /Espèces/i,
];

const OFFERS = [
  /Nexus\s+Cortex\s*\(ARIA\)/i,
  /Studio\s+Flex/i,
  /Académies\s+Nexus/i,
  /Programme\s+Odyssée/i,
];

const FOOTER = [
  /Mentions\s+légales/i,
  /CGV/i,
  /confidentialité/i,
  /contact/i,
];

test.describe('Contenus Site v2', () => {
  test('Homepage has expected hero, offers, payments and footer items', async ({ page }) => {
    const res = await page.request.get(`${BASE}/`);
    expect(res.ok()).toBeTruthy();
    const html = await res.text();

    if (process.env.E2E === '1') {
      // In stub mode, only assert 200 OK for main pages; strict content is validated in real job
      const offres = await page.request.get(`${BASE}/offres`);
      expect(offres.ok()).toBeTruthy();
    } else {
      for (const re of EXPECTS) expect(re.test(html)).toBeTruthy();
      // Visite page /offres et vérifie présence tuiles/sections
      const offres = await page.request.get(`${BASE}/offres`);
      expect(offres.ok()).toBeTruthy();
      const offersHtml = await offres.text();
      for (const re of OFFERS) expect(re.test(offersHtml)).toBeTruthy();
      // Footer
      const footerOk = FOOTER.some(re => re.test(html));
      expect(footerOk).toBeTruthy();
    }
  });
});
