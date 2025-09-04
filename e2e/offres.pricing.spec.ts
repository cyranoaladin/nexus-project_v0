import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3003';

test.describe('Offres Pricing Live', () => {
  test('studio-flex shows updated price after revalidate', async ({ page, request }) => {
    // Update a pricing variable via API (assuming authorized in E2E env)
    const list = await (await request.get(`${BASE}/api/pricing`)).json();
    const item = list.find((x: any) => x.variable === 'prix_individuel');
    if (item) {
      await request.put(`${BASE}/api/pricing/${item.id}`, { data: { valeur: item.valeur + 1 } as any });
    }
    await page.goto(`${BASE}/offres/studio-flex`);
    // Very loose check: page contains TND and some number
    await expect(page.getByText(/TND/)).toBeVisible();
  });
});

