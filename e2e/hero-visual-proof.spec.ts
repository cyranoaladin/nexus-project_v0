import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

for (const vp of VIEWPORTS) {
  test(`hero visual proof @ ${vp.name} (${vp.width}px)`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Find hero image
    const heroImg = page.locator('[data-hero] img').first();
    await expect(heroImg).toBeVisible({ timeout: 5000 });

    // Screenshot the hero section (viewport, not full-page)
    await page.screenshot({ path: `e2e/screenshots/hero-visual-${vp.name}-${vp.width}.png` });

    // Structural assertions
    const imgData = await heroImg.evaluate((img: HTMLImageElement) => {
      const r = img.getBoundingClientRect();
      return {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        renderedWidth: r.width,
        renderedHeight: r.height,
        objectFit: getComputedStyle(img).objectFit,
        // Check no stretching: aspect ratio preserved
        naturalRatio: img.naturalWidth / img.naturalHeight,
        renderedRatio: r.width / r.height,
        // Check no empty bands: image fills its container
        containerWidth: (img.parentElement?.getBoundingClientRect().width ?? 0),
        containerHeight: (img.parentElement?.getBoundingClientRect().height ?? 0),
      };
    });

    console.log(`hero @ ${vp.width}px:`, JSON.stringify(imgData));

    // Image loaded
    expect(imgData.naturalWidth, 'naturalWidth > 0').toBeGreaterThan(0);
    // object-cover applied
    expect(imgData.objectFit, 'object-fit: cover').toBe('cover');
    // Image fills container (no empty bands)
    expect(imgData.renderedWidth, 'fills container width').toBeGreaterThanOrEqual(imgData.containerWidth - 2);
    expect(imgData.renderedHeight, 'fills container height').toBeGreaterThanOrEqual(imgData.containerHeight - 2);

    await ctx.close();
  });
}
