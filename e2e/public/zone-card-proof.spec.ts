import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

// Screenshot proof: first card with échéancier
for (const vp of VIEWPORTS) {
  test(`card zone proof @ ${vp.name} (${vp.width}px)`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/offres', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const card = page.locator('div').filter({ hasText: /^Échéancier/ }).locator('..').first();
    if (await card.count() > 0) {
      await card.screenshot({ path: `e2e/screenshots/zones/card-${vp.name}-${vp.width}.png` });
    }
    await ctx.close();
  });
}

// Anti-collision + anti-clip via data-testid
for (const vp of VIEWPORTS) {
  test(`anti-collision metrics @ ${vp.name} (${vp.width}px)`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/offres', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const metricContainers = Array.from(document.querySelectorAll(
        '[data-testid="metric-volume"], [data-testid="metric-total"], [data-testid="metric-groupe"]'
      ));
      const echeancierContainers = Array.from(document.querySelectorAll(
        '[data-testid="echeancier-acompte"], [data-testid="echeancier-mensualites"], [data-testid="echeancier-solde"]'
      ));
      const values = Array.from(document.querySelectorAll('[data-testid$="-value"]'));
      const collisions: string[] = [];

      // Non-vacuity
      if (metricContainers.length === 0) collisions.push('NON_VACUITY_FAIL: 0 metrics');
      if (echeancierContainers.length === 0) collisions.push('NON_VACUITY_FAIL: 0 echeancier');

      // Anti-clip
      values.forEach(el => {
        const e = el as HTMLElement;
        if (e.scrollWidth > e.clientWidth + 1) {
          collisions.push(`CLIP: ${e.dataset.testid} scrollW=${e.scrollWidth} > clientW=${e.clientWidth}`);
        }
      });

      // Adjacent metric containers overlap
      for (let i = 0; i < metricContainers.length - 1; i++) {
        const a = metricContainers[i].getBoundingClientRect();
        const b = metricContainers[i + 1].getBoundingClientRect();
        if (a.right > b.left + 2 && b.right > a.left + 2 && a.bottom > b.top + 2 && b.bottom > a.top + 2) {
          collisions.push(`OVERLAP: ${metricContainers[i].getAttribute('data-testid')} ↔ ${metricContainers[i + 1].getAttribute('data-testid')}`);
        }
      }

      return { metrics: metricContainers.length, echeancier: echeancierContainers.length, values: values.length, collisions };
    });

    console.log(`anti-collision @ ${vp.width}px: metrics=${result.metrics}, écheancier=${result.echeancier}, values=${result.values}, collisions=${JSON.stringify(result.collisions)}`);
    expect(result.collisions, `Collisions at ${vp.width}px`).toEqual([]);
    await ctx.close();
  });
}
