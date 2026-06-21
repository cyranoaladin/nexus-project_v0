import { test } from '@playwright/test';

const VPS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

for (const v of VPS) {
  test(`hero screenshot ${v.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height } });
    const p = await ctx.newPage();
    await p.goto('/', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `e2e/screenshots/hero-${v.name}-${v.width}.png` });
    await ctx.close();
  });
}
