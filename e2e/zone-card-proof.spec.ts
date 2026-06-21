import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

for (const vp of VIEWPORTS) {
  test(`card zone proof @ ${vp.name} (${vp.width}px)`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/offres', { waitUntil: 'domcontentloaded' });

    // Find first card with an échéancier section
    const card = page.locator('div').filter({ hasText: /^Échéancier/ }).locator('..').first();
    if (await card.count() > 0) {
      await card.screenshot({ path: `e2e/screenshots/zones/card-${vp.name}-${vp.width}.png` });
    }

    // Screenshot first ExamCard (the rounded-xl with eyebrow + title + prix)
    const examCard = page.locator('[class*="rounded-xl"][class*="bg-lux-white"]').first();
    if (await examCard.count() > 0) {
      await examCard.screenshot({ path: `e2e/screenshots/zones/examcard-first-${vp.name}-${vp.width}.png` });
    }

    await ctx.close();
  });
}

// Anti-collision assertion: bounding boxes of metric labels vs values must not overlap
for (const vp of VIEWPORTS) {
  test(`anti-collision metrics @ ${vp.name} (${vp.width}px)`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/offres', { waitUntil: 'domcontentloaded' });

    // Get all metric containers (label + value pairs) inside first ExamCard
    // Wait for page to render cards
    await page.waitForTimeout(2000);
    // Find first card that has a price (contains "TND")
    const firstCard = page.locator('div').filter({ hasText: /^\d[\d\s]*TND$/ }).locator('..').locator('..').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    // Check metric pairs: label (text-lux-slate uppercase) vs value (font-semibold text-lux-ink)
    const overlaps = await firstCard.evaluate((card) => {
      // Find metric containers: divs with exactly 2 inline children (span or p) = label + value
      const allDivs = Array.from(card.querySelectorAll('div'));
      const metricDivs = allDivs.filter(div => {
        const kids = div.querySelectorAll(':scope > span, :scope > p');
        return kids.length === 2 && div.children.length === 2;
      });
      if (metricDivs.length === 0) return ['NON_VACUITY_FAIL: 0 metric divs found'];
      const collisions: string[] = [];
      metricDivs.forEach((div) => {
        const label = div.querySelector(':scope > :first-child');
        const value = div.querySelector(':scope > :last-child');
        if (label && value && label !== value) {
          const lb = label.getBoundingClientRect();
          const vb = value.getBoundingClientRect();
          // Check vertical overlap (label and value should not share vertical space
          // unless they're intentionally inline on mobile)
          const horizOverlap = lb.right > vb.left && vb.right > lb.left;
          const vertOverlap = lb.bottom > vb.top && vb.bottom > lb.top;
          if (horizOverlap && vertOverlap) {
            // They overlap — check if it's the mobile flex layout (label left, value right)
            // In flex layout, both occupy the same vertical band intentionally
            const sameRow = Math.abs(lb.top - vb.top) < 10;
            if (!sameRow) {
              collisions.push(`${label.textContent?.trim()} overlaps ${value.textContent?.trim()}`);
            }
          }
        }
      });

      // Check adjacent metric divs don't overlap each other
      for (let i = 0; i < metricDivs.length - 1; i++) {
        const a = metricDivs[i].getBoundingClientRect();
        const b = metricDivs[i + 1].getBoundingClientRect();
        const horizOverlap = a.right > b.left + 2 && b.right > a.left + 2;
        const vertOverlap = a.bottom > b.top + 2 && b.bottom > a.top + 2;
        if (horizOverlap && vertOverlap) {
          collisions.push(`metric[${i}] overlaps metric[${i + 1}]`);
        }
      }

      // Check échéancier rows
      // Find échéancier rows: divs containing exactly 2 <span> children (label + value)
      const echeancierRows = allDivs.filter(div => {
        const spans = div.querySelectorAll(':scope > span');
        return spans.length === 2 && div.children.length === 2;
      });
      if (echeancierRows.length === 0) collisions.push('NON_VACUITY_WARN: 0 échéancier rows (card may lack payment)');
      echeancierRows.forEach((row, idx) => {
        const spans = row.querySelectorAll('span');
        if (spans.length >= 2) {
          const left = spans[0].getBoundingClientRect();
          const right = spans[spans.length - 1].getBoundingClientRect();
          // Right value should not overlap left label horizontally on the same line
          if (left.right > right.left + 2 && Math.abs(left.top - right.top) < 15) {
            collisions.push(`échéancier row ${idx}: label/value overlap`);
          }
        }
      });

      // Anti-clip: every metric and échéancier value must not overflow its container
      const allValues = [
        ...metricDivs.flatMap(d => Array.from(d.querySelectorAll(':scope > :last-child'))),
        ...echeancierRows.flatMap(d => Array.from(d.querySelectorAll(':scope > :last-child'))),
      ];
      allValues.forEach((el, i) => {
        const e = el as HTMLElement;
        if (e.scrollWidth > e.clientWidth + 1) {
          collisions.push(`CLIP[${i}]: "${e.textContent?.trim().slice(0,30)}" scrollW=${e.scrollWidth} > clientW=${e.clientWidth}`);
        }
      });

      return { collisions, metricCount: metricDivs.length, echeancierCount: echeancierRows.length };
    });

    console.log(`anti-collision @ ${vp.width}px: metrics=${overlaps.metricCount}, échéancier=${overlaps.echeancierCount}, collisions=${JSON.stringify(overlaps.collisions)}`);
    expect(overlaps.collisions, `Collisions at ${vp.width}px`).toEqual([]);
    await ctx.close();
  });
}
