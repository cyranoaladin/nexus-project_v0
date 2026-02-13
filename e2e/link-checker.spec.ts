import { test, expect } from '@playwright/test';

const PAGES = [
  '/',
  '/offres',
  '/contact',
  '/famille',
  '/equipe',
  '/notre-centre',
  '/academy',
  '/studio',
  '/consulting',
  '/education',
  '/academies-hiver',
  '/stages',
  '/stages/fevrier-2026',
];

test.describe('Marketing links integrity', () => {
  for (const path of PAGES) {
    test(`links on ${path} respond`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const hrefs = await page.$$eval('a[href]', (anchors) =>
        anchors.map((a) => a.getAttribute('href')).filter(Boolean)
      );

      const unique = Array.from(new Set(hrefs as string[]));
      const toCheck = unique.filter((href) => {
        if (!href) return false;
        if (href.startsWith('#')) return false;
        if (href.startsWith('mailto:')) return false;
        if (href.startsWith('tel:')) return false;
        if (href.startsWith('javascript:')) return false;
        if (href.startsWith('http://') || href.startsWith('https://')) return false;
        return true;
      });

      for (const href of toCheck) {
        const target = new URL(href, page.url()).toString();
        const response = await page.request.get(target);
        expect(response.status(), `Link ${href} on ${path} returned ${response.status()}`).toBeLessThan(400);
      }
    });
  }
});
