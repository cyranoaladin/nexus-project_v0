import { test, expect } from '@playwright/test';
import { resolvePublicLinkTarget } from '../helpers/public-link-target';

const PAGES = [
  '/',
  '/offres',
  '/contact',
  '/famille',
  '/equipe',
  '/notre-centre',
  '/accompagnement-scolaire',
  '/stages',
];

test.describe('Marketing links integrity', () => {
  for (const path of PAGES) {
    test(`links on ${path} respond`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const hrefs = await page.$$eval('a[href]', (anchors) =>
        anchors.map((a) => a.getAttribute('href')).filter(Boolean)
      );

      const unique = Array.from(new Set(hrefs as string[]));
      for (const href of unique) {
        const target = resolvePublicLinkTarget(href, page.url());
        expect(target.kind, 'Public links must use a supported navigation scheme').not.toBe('UNSAFE');
        if (target.kind !== 'INTERNAL') continue;
        const response = await page.request.get(target.url);
        expect(response.status(), `Internal link on ${path} returned ${response.status()}`).toBeLessThan(400);
      }
    });
  }
});
