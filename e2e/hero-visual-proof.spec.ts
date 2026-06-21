import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

const NATURAL_RATIO = 1672 / 941; // 1.7768

for (const vp of VIEWPORTS) {
  test(`hero image uncropped @ ${vp.name} (${vp.width}px)`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const heroImg = page.locator('[data-hero] img').first();
    await expect(heroImg).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: `e2e/screenshots/hero-visual-${vp.name}-${vp.width}.png` });

    const imgData = await heroImg.evaluate((img: HTMLImageElement) => {
      const r = img.getBoundingClientRect();
      return {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        renderedWidth: r.width,
        renderedHeight: r.height,
      };
    });

    console.log(`hero @ ${vp.width}px:`, JSON.stringify(imgData));

    // Image loaded
    expect(imgData.naturalWidth, 'naturalWidth > 0').toBeGreaterThan(0);

    // Aspect ratio preserved (< 1% deviation = no crop)
    const renderedRatio = imgData.renderedWidth / imgData.renderedHeight;
    const deviation = Math.abs(renderedRatio - NATURAL_RATIO) / NATURAL_RATIO;
    expect(deviation, `aspect ratio deviation ${(deviation * 100).toFixed(2)}% < 1%`).toBeLessThan(0.01);

    // No letterbox: image dimensions match container (width-driven)
    // w-full h-auto means renderedWidth should be > 0 and height proportional
    expect(imgData.renderedWidth, 'rendered width > 100px').toBeGreaterThan(100);
    expect(imgData.renderedHeight, 'rendered height > 50px').toBeGreaterThan(50);

    await ctx.close();
  });
}
