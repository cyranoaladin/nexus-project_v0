import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

const PATHS = [
  { name: 'annual', steps: ['Terminale', 'Scolarisé', 'Accompagnement annuel'], minMetrics: 9, minEcheancier: 6 },
  { name: 'stage', steps: ['Terminale', 'Scolarisé', 'Stage intensif'], minMetrics: 1, minEcheancier: 4 },
];

async function completeWizard(page: import('@playwright/test').Page, steps: string[]) {
  for (const label of steps) {
    await page.locator('button').filter({ hasText: label }).first().click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
}

for (const path of PATHS) {
  for (const vp of VIEWPORTS) {
    test(`/recommandation ${path.name} @ ${vp.name} (${vp.width}px) — no collision`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto('/recommandation', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      await completeWizard(page, path.steps);
      await expect(page.locator('text=Diagnostic complété')).toBeVisible({ timeout: 5000 });

      await page.screenshot({
        path: `e2e/screenshots/zones/reco-${path.name}-${vp.name}-${vp.width}.png`,
        fullPage: true,
      });

      const result = await page.evaluate(() => {
        // Containers only (not -value children)
        const metricContainers = Array.from(document.querySelectorAll(
          '[data-testid="metric-volume"], [data-testid="metric-total"], [data-testid="metric-groupe"]'
        ));
        const echeancierContainers = Array.from(document.querySelectorAll(
          '[data-testid="echeancier-acompte"], [data-testid="echeancier-mensualites"], [data-testid="echeancier-solde"]'
        ));
        const values = Array.from(document.querySelectorAll('[data-testid$="-value"]'));
        const collisions: string[] = [];

        // Anti-clip on every value element
        values.forEach(el => {
          const e = el as HTMLElement;
          if (e.scrollWidth > e.clientWidth + 1) {
            collisions.push(`CLIP: ${e.dataset.testid} scrollW=${e.scrollWidth} > clientW=${e.clientWidth}`);
          }
        });

        // Adjacent metric CONTAINERS overlap (Volume vs Total, not label vs own value)
        for (let i = 0; i < metricContainers.length - 1; i++) {
          const a = metricContainers[i].getBoundingClientRect();
          const b = metricContainers[i + 1].getBoundingClientRect();
          if (a.right > b.left + 2 && b.right > a.left + 2 && a.bottom > b.top + 2 && b.bottom > a.top + 2) {
            collisions.push(`OVERLAP: ${metricContainers[i].getAttribute('data-testid')} ↔ ${metricContainers[i + 1].getAttribute('data-testid')}`);
          }
        }

        // Arrow spacing
        values.filter(el => el.textContent?.includes('→')).forEach(el => {
          if (/[^\s\u00A0]→|→[^\s\u00A0]/.test(el.textContent ?? '')) {
            collisions.push(`ARROW_SPACING: ${el.getAttribute('data-testid')}`);
          }
        });

        return {
          metrics: metricContainers.length,
          echeancier: echeancierContainers.length,
          values: values.length,
          collisions,
        };
      });

      console.log(`/recommandation ${path.name} @ ${vp.width}px: metrics=${result.metrics}, écheancier=${result.echeancier}, values=${result.values}, collisions=${JSON.stringify(result.collisions)}`);

      // Non-vacuity
      expect(result.metrics, `${path.name}: metrics >= ${path.minMetrics}`).toBeGreaterThanOrEqual(path.minMetrics);
      expect(result.echeancier, `${path.name}: echeancier >= ${path.minEcheancier}`).toBeGreaterThanOrEqual(path.minEcheancier);
      // Zero collisions
      expect(result.collisions, `Collisions at ${vp.width}px`).toEqual([]);

      await ctx.close();
    });
  }
}
