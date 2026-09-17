import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

// ── Screenshots ──
for (const vp of VIEWPORTS) {
  test(`home visual signature @ ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `e2e/screenshots/home-passe1-${vp.name}-${vp.width}.png`, fullPage: true });
    await ctx.close();
  });
}

// ── Serif h2 proof ──
test('all section h2s use Fraunces (serif)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    const sections = document.querySelectorAll('main > section');
    const h2s: { text: string; fontFamily: string; isSerif: boolean }[] = [];
    sections.forEach((s) => {
      const h2 = s.querySelector('h2');
      if (!h2) return;
      const ff = getComputedStyle(h2).fontFamily;
      h2s.push({
        text: h2.textContent?.slice(0, 40) ?? '',
        fontFamily: ff.slice(0, 60),
        isSerif: ff.toLowerCase().includes('fraunces'),
      });
    });
    return h2s;
  });

  console.log('H2 font families:', JSON.stringify(result, null, 2));

  for (const h2 of result) {
    expect(h2.isSerif, `"${h2.text}" should use Fraunces — got ${h2.fontFamily}`).toBe(true);
  }

  await ctx.close();
});

// ── Gold filets proof ──
test('gold filets present under section headers', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    const filets = document.querySelectorAll('main .lux-filet-gold');
    const data: { parentSection: string; borderColor: string; painted: boolean }[] = [];
    filets.forEach((f) => {
      const section = f.closest('section');
      const h2 = section?.querySelector('h2');
      const cs = getComputedStyle(f);
      const bc = cs.borderBottomColor;
      data.push({
        parentSection: h2?.textContent?.slice(0, 30) ?? 'unknown',
        borderColor: bc,
        painted: bc !== 'rgba(0, 0, 0, 0)' && bc !== 'transparent',
      });
    });
    return { count: filets.length, filets: data };
  });

  console.log('Gold filets:', JSON.stringify(result));

  // At least 4 filets (Enjeux, Méthode, Tarifs, Confiance, Parcours)
  expect(result.count, 'filet count').toBeGreaterThanOrEqual(4);
  for (const f of result.filets) {
    expect(f.painted, `filet in "${f.parentSection}" painted`).toBe(true);
  }

  await ctx.close();
});

// ── Elevation differentiation proof ──
test('primary cards elevated, secondary cards flat', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    function getShadow(el: Element): string {
      return getComputedStyle(el).boxShadow;
    }

    // Primary: level cards
    const levelCard = document.querySelector('[data-card="level-primary"]');
    const levelShadow = levelCard ? getShadow(levelCard) : 'not found';

    // Primary: method cards (on dark, use border instead of shadow)
    const methodCard = document.querySelector('[data-card="method-primary"]');
    const methodBorder = methodCard ? getComputedStyle(methodCard).borderColor : 'not found';

    // Secondary: verifiable items
    const verifiableCard = document.querySelector('[data-card="verifiable-secondary"]');
    const verifiableShadow = verifiableCard ? getShadow(verifiableCard) : 'not found';

    // Secondary: chips
    const chipCard = document.querySelector('[data-card="chip-secondary"]');
    const chipShadow = chipCard ? getShadow(chipCard) : 'not found';

    return {
      levelShadow,
      methodBorder,
      verifiableShadow,
      chipShadow,
    };
  });

  console.log('Elevation:', JSON.stringify(result));

  // Primary level cards have shadow
  expect(result.levelShadow).not.toBe('none');
  expect(result.levelShadow).not.toBe('not found');

  // Secondary cards are flat (no shadow or 'none')
  expect(
    result.verifiableShadow === 'none' || result.verifiableShadow === '',
    `verifiable card flat — got: ${result.verifiableShadow}`
  ).toBe(true);
  expect(
    result.chipShadow === 'none' || result.chipShadow === '',
    `chip card flat — got: ${result.chipShadow}`
  ).toBe(true);

  await ctx.close();
});

// ── Navy band cards contrast re-proof ──
test('navy method cards: contrast still ≥ AA after border change', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    function parseColor(str: string): [number, number, number] | null {
      const m = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (m) return [+m[1], +m[2], +m[3]];
      const m2 = str.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      if (m2) return [+m2[1], +m2[2], +m2[3]];
      return null;
    }
    function sRGBtoLinear(c: number) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    function luminance(r: number, g: number, b: number) { return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b); }
    function contrast(l1: number, l2: number) { return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

    const card = document.querySelector('[data-card="method-primary"]');
    if (!card) return { found: false };

    const cardBg = parseColor(getComputedStyle(card).backgroundColor);
    const h3 = card.querySelector('h3');
    const p = card.querySelector('p');
    const h3Color = h3 ? parseColor(getComputedStyle(h3).color) : null;
    const pColor = p ? parseColor(getComputedStyle(p).color) : null;

    const lBg = cardBg ? luminance(...cardBg) : 0;
    const h3Ratio = h3Color ? contrast(luminance(...h3Color), lBg) : 0;
    const pRatio = pColor ? contrast(luminance(...pColor), lBg) : 0;

    return {
      found: true,
      cardBg: cardBg?.join(','),
      h3Ratio: +h3Ratio.toFixed(1),
      pRatio: +pRatio.toFixed(1),
      borderColor: getComputedStyle(card).borderColor,
    };
  });

  console.log('Navy card contrast:', JSON.stringify(result));

  expect(result.found).toBe(true);
  expect(result.h3Ratio, 'h3 ≥ 4.5 (AA)').toBeGreaterThanOrEqual(4.5);
  expect(result.pRatio, 'p ≥ 4.5 (AA)').toBeGreaterThanOrEqual(4.5);

  await ctx.close();
});
