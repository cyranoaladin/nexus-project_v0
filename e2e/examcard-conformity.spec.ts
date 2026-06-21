import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

for (const vp of VIEWPORTS) {
  test(`ExamCard conformity /offres @ ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/offres', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Screenshot
    await page.screenshot({ path: `e2e/screenshots/offres-conformity-${vp.name}-${vp.width}.png`, fullPage: true });

    await ctx.close();
  });
}

// Recommandation conformity — wizard driven
for (const vp of VIEWPORTS) {
  test(`ExamCard conformity /recommandation @ ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/recommandation', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    // Complete wizard
    for (const label of ['Terminale', 'Scolarisé', 'Accompagnement annuel']) {
      await page.locator('button').filter({ hasText: label }).first().click();
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(500);

    await page.screenshot({ path: `e2e/screenshots/reco-conformity-${vp.name}-${vp.width}.png`, fullPage: true });

    // Assert featured card has distinctive classes
    const result = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[class*="@container"]'));
      const featured = cards.find(c => c.className.includes('ring-'));
      const standard = cards.find(c => !c.className.includes('ring-') && c.className.includes('border'));

      return {
        totalCards: cards.length,
        featuredFound: !!featured,
        featuredHasGoldRing: featured?.className.includes('ring-lux-gold') ?? false,
        featuredHasBadge: !!featured?.querySelector('[class*="bg-lux-gold"]'),
        featuredHasScale: featured?.className.includes('scale-') ?? false,
        featuredCtaClass: featured?.querySelector('a[class*="lux-cta"]')?.className ?? '',
        standardCtaClass: standard?.querySelector('a[class*="lux-cta"]')?.className ?? '',
        // Check filet gold exists in both
        featuredHasFilet: !!featured?.querySelector('.lux-filet-gold'),
        standardHasFilet: !!standard?.querySelector('.lux-filet-gold'),
        // Check gold checkmarks
        featuredHasGoldChecks: (featured?.querySelectorAll('[class*="text-lux-gold"]') ?? []).length > 0,
      };
    });

    console.log(`ExamCard conformity @ ${vp.width}px:`, JSON.stringify(result));

    expect(result.totalCards, 'cards found').toBeGreaterThanOrEqual(3);
    expect(result.featuredFound, 'featured card found').toBe(true);
    expect(result.featuredHasGoldRing, 'featured: ring-lux-gold').toBe(true);
    expect(result.featuredHasBadge, 'featured: gold badge').toBe(true);
    expect(result.featuredHasScale, 'featured: scale elevation').toBe(true);
    expect(result.featuredCtaClass, 'featured CTA = lux-cta-reserve').toContain('lux-cta-reserve');
    expect(result.standardCtaClass, 'standard CTA = lux-cta-primary').toContain('lux-cta-primary');
    expect(result.featuredHasFilet, 'featured: lux-filet-gold').toBe(true);
    expect(result.standardHasFilet, 'standard: lux-filet-gold').toBe(true);
    expect(result.featuredHasGoldChecks, 'featured: gold checkmarks').toBe(true);

    await ctx.close();
  });
}
