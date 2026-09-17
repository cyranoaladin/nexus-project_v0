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

    // Assert featured card has distinctive classes + computed styles
    const result = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[class*="@container"]'));
      const featured = cards.find(c => c.className.includes('ring-'));
      const standard = cards.find(c => !c.className.includes('ring-') && c.className.includes('border'));

      // --- Computed style helpers ---
      function getBg(el: Element | null | undefined): string {
        if (!el) return '';
        return getComputedStyle(el).backgroundColor;
      }
      function getBorder(el: Element | null | undefined) {
        if (!el) return { width: '', color: '' };
        const cs = getComputedStyle(el);
        return { width: cs.borderWidth, color: cs.borderColor };
      }
      function isTransparent(bg: string): boolean {
        return bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent' || bg === '';
      }

      // Metrics bloc (bg-lux-paper/70)
      const metricsBloc = featured?.querySelector('[class*="bg-lux-paper"]');
      const metricsBg = getBg(metricsBloc);

      // Standard CTA
      const standardCta = standard?.querySelector('a[class*="border-lux-ink"]') as HTMLElement | null;
      const standardCtaBg = getBg(standardCta);
      const standardCtaBorder = getBorder(standardCta);

      // Featured CTA
      const featuredCta = featured?.querySelector('a[class*="lux-cta"]') as HTMLElement | null;
      const featuredCtaBg = getBg(featuredCta);

      return {
        totalCards: cards.length,
        featuredFound: !!featured,
        featuredHasGoldRing: featured?.className.includes('ring-lux-gold') ?? false,
        featuredHasBadge: !!featured?.querySelector('[class*="bg-lux-gold"]'),
        featuredHasScale: featured?.className.includes('scale-') ?? false,
        featuredCtaClass: featuredCta?.className ?? '',
        standardCtaClass: standardCta?.className ?? '',
        standardCtaIsContour: !!standard?.querySelector('a[class*="border-lux-ink"][class*="bg-transparent"]'),
        featuredHasFilet: !!featured?.querySelector('.lux-filet-gold'),
        standardHasFilet: !!standard?.querySelector('.lux-filet-gold'),
        featuredHasGoldChecks: (featured?.querySelectorAll('[class*="text-lux-gold"]') ?? []).length > 0,
        // Computed style proofs
        metricsBlocBgPainted: !isTransparent(metricsBg),
        metricsBlocBg: metricsBg,
        standardCtaBgTransparent: isTransparent(standardCtaBg),
        standardCtaBg: standardCtaBg,
        standardCtaBorderWidthGt0: parseFloat(standardCtaBorder.width) > 0,
        standardCtaBorder: standardCtaBorder,
        featuredCtaBgPainted: !isTransparent(featuredCtaBg),
        featuredCtaBg: featuredCtaBg,
        featuredCtaDistinctFromStandard: featuredCtaBg !== standardCtaBg,
      };
    });

    console.log(`ExamCard conformity @ ${vp.width}px:`, JSON.stringify(result));

    // Class-based assertions
    expect(result.totalCards, 'cards found').toBeGreaterThanOrEqual(3);
    expect(result.featuredFound, 'featured card found').toBe(true);
    expect(result.featuredHasGoldRing, 'featured: ring-lux-gold').toBe(true);
    expect(result.featuredHasBadge, 'featured: gold badge').toBe(true);
    expect(result.featuredHasScale, 'featured: scale elevation').toBe(true);
    expect(result.featuredCtaClass, 'featured CTA = lux-cta-reserve').toContain('lux-cta-reserve');
    expect(result.standardCtaIsContour, 'standard CTA = navy contour (border-lux-ink + bg-transparent)').toBe(true);
    expect(result.featuredHasFilet, 'featured: lux-filet-gold').toBe(true);
    expect(result.standardHasFilet, 'standard: lux-filet-gold').toBe(true);
    expect(result.featuredHasGoldChecks, 'featured: gold checkmarks').toBe(true);

    // Computed style proofs
    expect(result.metricsBlocBgPainted, `metrics bloc bg painted (${result.metricsBlocBg})`).toBe(true);
    expect(result.standardCtaBgTransparent, `standard CTA bg transparent (${result.standardCtaBg})`).toBe(true);
    expect(result.standardCtaBorderWidthGt0, `standard CTA border > 0 (${JSON.stringify(result.standardCtaBorder)})`).toBe(true);
    expect(result.featuredCtaBgPainted, `featured CTA bg painted (${result.featuredCtaBg})`).toBe(true);
    expect(result.featuredCtaDistinctFromStandard, 'featured CTA bg distinct from standard CTA bg').toBe(true);

    await ctx.close();
  });
}
