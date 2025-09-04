import { expect, test } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3003';

const PUBLIC_PATHS = [
  '/',
  '/offres',
  '/a-propos',
  '/notre-centre',
  '/equipe',
  '/contact',
  '/cgu',
  '/cgv',
  '/mentions-legales',
  '/politique-confidentialite',
  '/bilan-gratuit',
  '/aria',
];

test.describe('Crawl public pages & buttons', () => {
  for (const path of PUBLIC_PATHS) {
    test(`200/3xx OK for ${path}`, async ({ page }) => {
      const res = await page.request.get(`${BASE}${path}`);
      const status = res.status();
      expect(status).toBeGreaterThanOrEqual(200);
      expect(status).toBeLessThan(400);
      if (status === 200) {
        const html = await res.text();
        expect(html.length).toBeGreaterThan(100);
      }
    });
  }

  test.fixme('Homepage has key hero contents and valid links (flaky crawler to be stabilized)', async () => {});
});
