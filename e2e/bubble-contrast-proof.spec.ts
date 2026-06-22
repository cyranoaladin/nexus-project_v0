import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

// ── Screenshots: homepage + recommandation ──
for (const vp of VIEWPORTS) {
  test(`homepage screenshot @ ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `e2e/screenshots/home-squelette-${vp.name}-${vp.width}.png`, fullPage: true });
    await ctx.close();
  });
}

for (const vp of VIEWPORTS) {
  test(`recommandation screenshot @ ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/recommandation', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `e2e/screenshots/reco-squelette-${vp.name}-${vp.width}.png`, fullPage: true });
    await ctx.close();
  });
}

// ── Bubble hidden on /recommandation ──
test('FloatingAdvisorBubble hidden on /recommandation (desktop)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/recommandation', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const bubble = page.locator('a.fixed[href*="wa.me"]');
  // Bubble should be absent from DOM (returns null) or have 0 count
  const count = await bubble.count();
  expect(count, 'bubble absent on /recommandation').toBe(0);

  await ctx.close();
});

// ── Bubble hidden while hero visible, shown after scroll ──
test('bubble hidden while hero visible, no occlude after scroll (desktop)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Bubble should be hidden while hero is in viewport
  const bubbleBefore = page.locator('a.fixed[href*="wa.me"]');
  const countBefore = await bubbleBefore.count();
  expect(countBefore, 'bubble hidden while hero visible').toBe(0);

  // "Candidat libre" is safe at initial load (no bubble)
  const candidatLink = page.locator('a:has-text("Candidat libre")').first();
  await expect(candidatLink).toBeVisible();

  // Scroll past hero to trigger bubble
  await page.evaluate(() => window.scrollBy(0, 1200));
  await page.waitForTimeout(800);

  // After scroll, bubble may appear — verify it doesn't cover any section CTA
  const bubbleAfter = page.locator('a.fixed[href*="wa.me"]');
  const countAfter = await bubbleAfter.count();
  if (countAfter > 0 && await bubbleAfter.first().isVisible()) {
    // Bubble is visible — verify "Candidat libre" is now scrolled off or not overlapped
    const bubbleBox = await bubbleAfter.first().boundingBox();
    const linkBox = await candidatLink.boundingBox();
    if (bubbleBox && linkBox) {
      const overlaps =
        linkBox.x < bubbleBox.x + bubbleBox.width &&
        linkBox.x + linkBox.width > bubbleBox.x &&
        linkBox.y < bubbleBox.y + bubbleBox.height &&
        linkBox.y + linkBox.height > bubbleBox.y;
      expect(overlaps, 'bubble must not overlap Candidat libre after scroll').toBe(false);
    }
  }

  await ctx.close();
});

// ── Dark method section contrast proof (computed) ──
test('MethodSection dark: text contrast ≥ AA on bg-lux-ink', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    // Find the dark method section (bg-lux-ink with "Notre méthode")
    const sections = Array.from(document.querySelectorAll('section'));
    const methodSection = sections.find(
      (s) => s.className.includes('bg-lux-ink') && s.textContent?.includes('Notre méthode')
    );
    if (!methodSection) return { found: false };

    function parseColor(str: string): [number, number, number] | null {
      const m = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (m) return [+m[1], +m[2], +m[3]];
      const m2 = str.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      if (m2) return [+m2[1], +m2[2], +m2[3]];
      return null;
    }

    function sRGBtoLinear(c: number) {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }

    function luminance(r: number, g: number, b: number) {
      return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
    }

    function contrast(l1: number, l2: number) {
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    const sectionBg = parseColor(getComputedStyle(methodSection).backgroundColor);
    if (!sectionBg) return { found: true, error: 'cannot parse section bg' };
    const lBg = luminance(...sectionBg);

    // Check h2 (title) contrast
    const h2 = methodSection.querySelector('h2');
    const h2Color = h2 ? parseColor(getComputedStyle(h2).color) : null;
    const h2Ratio = h2Color ? contrast(luminance(...h2Color), lBg) : 0;

    // Check description text contrast
    const desc = methodSection.querySelector('p');
    const descColor = desc ? parseColor(getComputedStyle(desc).color) : null;
    const descRatio = descColor ? contrast(luminance(...descColor), lBg) : 0;

    // Check card text
    const card = methodSection.querySelector('[class*="rounded-xl"]');
    const cardH3 = card?.querySelector('h3');
    const cardP = card?.querySelector('p');
    const cardH3Color = cardH3 ? parseColor(getComputedStyle(cardH3).color) : null;
    const cardPColor = cardP ? parseColor(getComputedStyle(cardP).color) : null;
    const cardBg = card ? parseColor(getComputedStyle(card).backgroundColor) : null;
    const lCardBg = cardBg ? luminance(...cardBg) : lBg;
    const cardH3Ratio = cardH3Color ? contrast(luminance(...cardH3Color), lCardBg) : 0;
    const cardPRatio = cardPColor ? contrast(luminance(...cardPColor), lCardBg) : 0;

    return {
      found: true,
      sectionBg: sectionBg.join(','),
      h2Ratio: +h2Ratio.toFixed(1),
      descRatio: +descRatio.toFixed(1),
      cardH3Ratio: +cardH3Ratio.toFixed(1),
      cardPRatio: +cardPRatio.toFixed(1),
    };
  });

  console.log('MethodSection contrast:', JSON.stringify(result));

  expect(result.found, 'method section found').toBe(true);
  // AA normal text ≥ 4.5, AA large text ≥ 3.0
  expect(result.h2Ratio, 'h2 contrast ≥ 4.5 (AA)').toBeGreaterThanOrEqual(4.5);
  expect(result.descRatio, 'desc contrast ≥ 4.5 (AA)').toBeGreaterThanOrEqual(4.5);
  expect(result.cardH3Ratio, 'card h3 contrast ≥ 4.5 (AA)').toBeGreaterThanOrEqual(4.5);
  expect(result.cardPRatio, 'card p contrast ≥ 4.5 (AA)').toBeGreaterThanOrEqual(4.5);

  await ctx.close();
});
