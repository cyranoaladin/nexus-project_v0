import { test, expect } from '@playwright/test';

test('pre-check: Terminale Duo échéancier matches canonical', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/recommandation', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Complete wizard: Terminale → Scolarisé → Accompagnement annuel
  for (const label of ['Terminale', 'Scolarisé', 'Accompagnement annuel']) {
    await page.locator('button').filter({ hasText: label }).first().click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);

  // Find the Duo card and extract échéancier values
  const duoCard = page.locator('div').filter({ hasText: /Terminale Duo/ }).filter({ hasText: /Acompte/ }).first();
  await expect(duoCard).toBeVisible({ timeout: 5000 });
  await duoCard.screenshot({ path: 'e2e/screenshots/zones/precheck-duo-1280.png' });

  const values = await duoCard.evaluate((card) => {
    const text = card.textContent ?? '';
    return {
      fullText: text,
      hasAcompte2150: /2[\s\u00A0]?150\s*TND/.test(text),
      has560: text.includes('560'),
      has545: text.includes('545'),
      has960: text.includes('960'),
    };
  });

  console.log('Duo card values:', JSON.stringify(values, null, 2));
  expect(values.hasAcompte2150, 'Acompte = 2 150 TND').toBe(true);
  expect(values.has560, 'Installment 560 TND').toBe(true);
  expect(values.has545, 'Last installment 545 TND').toBe(true);
  expect(values.has960, 'Should NOT contain 960').toBe(false);

  await ctx.close();
});
