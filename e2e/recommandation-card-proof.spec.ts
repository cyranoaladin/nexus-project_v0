import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

// Two wizard paths: annual (full metrics) and stage (simpler cards)
const PATHS = [
  { name: 'annual', steps: ['Terminale', 'Scolarisé', 'Accompagnement annuel'] },
  { name: 'stage', steps: ['Terminale', 'Scolarisé', 'Stage intensif'] },
];

async function completeWizard(page: import('@playwright/test').Page, steps: string[]) {
  for (const label of steps) {
    const option = page.locator('button').filter({ hasText: label }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
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

      // Verify cards appeared
      const resultsHeader = page.locator('text=Diagnostic complété');
      await expect(resultsHeader).toBeVisible({ timeout: 5000 });

      // Screenshot full results
      await page.screenshot({
        path: `e2e/screenshots/zones/reco-${path.name}-${vp.name}-${vp.width}.png`,
        fullPage: true,
      });

      // Anti-collision: check all label/value pairs in the results area
      const result = await page.evaluate(() => {
        const body = document.body;
        const allDivs = Array.from(body.querySelectorAll('div'));

        // Metric divs: exactly 2 inline children (span/p in any combo)
        const metricDivs = allDivs.filter(div => {
          const kids = div.querySelectorAll(':scope > span, :scope > p');
          return kids.length === 2 && div.children.length === 2;
        });

        // Échéancier rows: same pattern (2 inline children)
        const echeancierRows = metricDivs; // unified selector — collision checks apply to all

        const collisions: string[] = [];

        // Check metric label/value don't collide
        metricDivs.forEach(div => {
          const label = div.querySelector(':scope > :first-child') as HTMLElement | null;
          const value = div.querySelector(':scope > :last-child') as HTMLElement | null;
          if (label && value && label !== value) {
            const lb = label.getBoundingClientRect();
            const vb = value.getBoundingClientRect();
            const sameRow = Math.abs(lb.top - vb.top) < 10;
            const overlap = lb.right > vb.left && vb.right > lb.left && lb.bottom > vb.top && vb.bottom > lb.top;
            if (overlap && !sameRow) {
              collisions.push(`METRIC: "${label.textContent?.trim()}" ↔ "${value.textContent?.trim()}"`);
            }
          }
        });

        // Inter-cell check: adjacent metric divs must not overlap
        for (let i = 0; i < metricDivs.length - 1; i++) {
          const a = metricDivs[i].getBoundingClientRect();
          const b = metricDivs[i + 1].getBoundingClientRect();
          const hOverlap = a.right > b.left + 2 && b.right > a.left + 2;
          const vOverlap = a.bottom > b.top + 2 && b.bottom > a.top + 2;
          if (hOverlap && vOverlap) {
            collisions.push(`INTER-CELL[${i}↔${i+1}]: "${metricDivs[i].textContent?.trim().slice(0,20)}" ↔ "${metricDivs[i+1].textContent?.trim().slice(0,20)}"`);
          }
        }

        // Check échéancier labels don't overlap values
        echeancierRows.forEach((row, i) => {
          const kids = Array.from(row.querySelectorAll(':scope > span, :scope > p'));
          if (kids.length >= 2) {
            const l = kids[0].getBoundingClientRect();
            const r = kids[kids.length - 1].getBoundingClientRect();
            if (l.right > r.left + 2 && Math.abs(l.top - r.top) < 15) {
              collisions.push(`ECHEANCIER[${i}]: "${kids[0].textContent}" ↔ "${kids[1].textContent}"`);
            }
          }
        });

        // Arrow spacing check: → must have space on both sides
        const arrowSpans = Array.from(body.querySelectorAll('span')).filter(s =>
          s.textContent?.includes('→')
        );
        const arrowIssues = arrowSpans.filter(s => {
          const t = s.textContent ?? '';
          // Must have a non-breaking space or regular space before and after →
          return /[^\s\u00A0]→|→[^\s\u00A0]/.test(t);
        });
        if (arrowIssues.length > 0) {
          collisions.push(`ARROW_SPACING: ${arrowIssues.length} arrows without proper spacing`);
        }

        return {
          metricDivs: metricDivs.length,
          echeancierRows: echeancierRows.length,
          arrowCount: arrowSpans.length,
          collisions,
        };
      });

      console.log(`/recommandation ${path.name} @ ${vp.width}px: metrics=${result.metricDivs}, échéancier=${result.echeancierRows}, arrows=${result.arrowCount}, collisions=${JSON.stringify(result.collisions)}`);

      // Collisions empty is the key assertion; metricDivs count varies by card structure
      // Either path: no collisions
      expect(result.collisions, `Collisions at ${vp.width}px`).toEqual([]);

      await ctx.close();
    });
  }
}
