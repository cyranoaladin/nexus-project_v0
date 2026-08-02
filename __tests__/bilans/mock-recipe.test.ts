import { readFile } from 'node:fs/promises';
import path from 'node:path';

import entryMetrics from '@/data/bilans/recipe/entree-terminale-maths-v1-mock-metrics.json';
import entryPacket from '@/data/bilans/recipe/entree-terminale-maths-v1-mock-review-packet.json';
import endMetrics from '@/data/bilans/recipe/maths-terminale-bilan-v1-mock-metrics.json';
import endPacket from '@/data/bilans/recipe/maths-terminale-bilan-v1-mock-review-packet.json';
import { generateMockRecipeEvidence } from '@/scripts/bilans/generate-mock-recipe-evidence';

import { ENTRY_RECIPE_FACT_SHEETS, RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';
import { ENTRY_VALIDATED_PACK_FIXTURE, VALIDATED_PACK_FIXTURE } from './fixtures/validated-pack';

const RECIPES = [
  {
    slug: 'entree-terminale-maths-v1',
    pack: ENTRY_VALIDATED_PACK_FIXTURE,
    factSheets: ENTRY_RECIPE_FACT_SHEETS,
    metrics: entryMetrics,
    packet: entryPacket,
  },
  {
    slug: 'maths-terminale-bilan-v1',
    pack: VALIDATED_PACK_FIXTURE,
    factSheets: RECIPE_FACT_SHEETS,
    metrics: endMetrics,
    packet: endPacket,
  },
] as const;

describe.each(RECIPES)('$slug mock technical recipe', ({ slug, pack, factSheets, metrics, packet }) => {
  it('generates byte-identical versioned evidence twice without network', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    let first;
    let second;
    try {
      first = await generateMockRecipeEvidence(factSheets, pack, slug);
      second = await generateMockRecipeEvidence(factSheets, pack, slug);
    } finally {
      fetchSpy.mockRestore();
    }

    const [versionedMetrics, versionedReviewPacket] = await Promise.all([
      readFile(path.join(process.cwd(), `data/bilans/recipe/${slug}-mock-metrics.json`), 'utf8'),
      readFile(path.join(process.cwd(), `data/bilans/recipe/${slug}-mock-review-packet.json`), 'utf8'),
    ]);

    expect(first.metricsJson).toBe(second.metricsJson);
    expect(first.reviewPacketJson).toBe(second.reviewPacketJson);
    expect(first.metricsJson).toBe(versionedMetrics);
    expect(first.reviewPacketJson).toBe(versionedReviewPacket);
    expect(first.metrics).toEqual(metrics);
    expect(first.reviewPacket).toEqual(packet);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(first.requests)).not.toMatch(/Camille|@/);
    expect(first.metrics.validationViolations.V2).toBe(0);
    expect(first.metrics.validationViolations.V6).toBe(0);
    expect(first.reviewPacket.reports).toHaveLength(60);
  });
});
