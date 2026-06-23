import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { loginAsUser } from '../helpers/auth';

const canonicalPath = path.join(__dirname, '../../data/pricing.canonical.json');
const pricing = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));

const expectedVisibleCount =
  pricing.offers.length +
  pricing.stage_formats.length +
  pricing.ponctuel_offers.length +
  pricing.coaching.length +
  pricing.packs.length +
  pricing.special_programs.length +
  Object.keys(pricing.urgence).length;

test.describe('assistant devis assistante - catalogue canonique', () => {
  test('serves the operational devis catalog from canonical pricing', async ({ page }) => {
    await loginAsUser(page, 'assistante', {
      navigate: false,
      targetPath: '/dashboard/assistante/devis',
    });

    const response = await page.request.get('/dashboard/assistante/devis/assets/catalogue-operationnel.json');
    expect(response.status()).toBe(200);
    const catalog = await response.json();
    const entries = Object.entries(catalog).filter(([key]) => !key.startsWith('_'));

    expect(catalog._meta).toMatchObject({
      source: 'data/pricing.canonical.json',
      loader: 'lib/pricing.ts',
      version: pricing.version,
    });
    expect(entries).toHaveLength(expectedVisibleCount);
    expect(catalog[pricing.offers[0].id]).toMatchObject({
      sourceType: 'annual_offer',
      sourceId: pricing.offers[0].id,
      label: pricing.offers[0].title,
      annual: pricing.offers[0].price_annual,
    });
    expect(catalog[`stage:${pricing.stage_formats[0].format_id}`]).toMatchObject({
      sourceType: 'stage_format',
      sourceId: pricing.stage_formats[0].format_id,
      label: `Stage - ${pricing.stage_formats[0].title}`,
    });
    for (const [, offer] of entries) {
      expect(offer).not.toHaveProperty('publicAnnual');
    }
  });

  test('renders manual devis options from the canonical catalog without legacy price copy', async ({ page }) => {
    test.setTimeout(90_000);

    await loginAsUser(page, 'assistante', {
      navigate: true,
      targetPath: '/dashboard/assistante/devis',
    });

    await expect(page.getByRole('heading', { name: 'Assistant conseil & devis' })).toBeVisible();
    await expect(page.locator('#main-content iframe[title="Assistant conseil et devis Nexus Réussite"]')).toBeAttached();
    const frame = page.frameLocator('#main-content iframe[title="Assistant conseil et devis Nexus Réussite"]');

    const selectOptions = frame.locator('#manualOfferSelect option');
    await expect(selectOptions).toHaveCount(expectedVisibleCount + 1, { timeout: 60_000 });

    await expect(selectOptions.filter({ hasText: `${pricing.offers[0].title} —` })).toHaveCount(1);
    await expect(selectOptions.filter({ hasText: `Stage - ${pricing.stage_formats[0].title} —` })).toHaveCount(1);
    await expect(selectOptions.filter({ hasText: `${pricing.coaching[0].title} —` })).toHaveCount(1);
    await expect(selectOptions.filter({ hasText: `${pricing.packs[0].title} —` })).toHaveCount(1);
    await expect(frame.getByText('Mixte 8 750 vs 7 900 TND')).toHaveCount(0);
    await expect(frame.getByText('Les tarifs affichés proviennent du catalogue opérationnel validé.')).toHaveCount(1);
  });
});
