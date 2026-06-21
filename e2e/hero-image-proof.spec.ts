import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

for (const vp of VIEWPORTS) {
  test(`hero image renders @ ${vp.name} (${vp.width}px)`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Find the hero image
    const heroImg = page.locator('[data-hero] img').first();
    await expect(heroImg).toBeVisible({ timeout: 5000 });

    // Assert image loaded (naturalWidth > 0)
    const naturalWidth = await heroImg.evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(naturalWidth, `hero image naturalWidth > 0 at ${vp.width}px`).toBeGreaterThan(0);

    // Screenshot
    await page.screenshot({ path: `e2e/screenshots/hero-${vp.name}-${vp.width}.png` });

    await ctx.close();
  });
}
