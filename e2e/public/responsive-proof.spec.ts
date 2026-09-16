import { test, expect } from '@playwright/test';

const PAGES = ['/', '/offres', '/recommandation'];
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

for (const page of PAGES) {
  for (const vp of VIEWPORTS) {
    test(`${page} @ ${vp.name} (${vp.width}px) — no horizontal overflow`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const p = await context.newPage();
      await p.goto(page, { waitUntil: 'domcontentloaded' });

      // Assert no horizontal overflow
      const overflow = await p.evaluate(() => {
        const el = document.scrollingElement ?? document.documentElement;
        return el.scrollWidth > el.clientWidth;
      });
      expect(overflow, `Horizontal overflow on ${page} @ ${vp.width}px`).toBe(false);

      // Screenshot
      const slug = page === '/' ? 'home' : page.replace(/\//g, '');
      await p.screenshot({
        path: `e2e/screenshots/${slug}-${vp.name}-${vp.width}.png`,
        fullPage: true,
      });

      await context.close();
    });
  }
}
