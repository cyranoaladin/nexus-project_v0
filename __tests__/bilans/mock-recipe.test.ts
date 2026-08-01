import { readFile } from 'node:fs/promises';
import path from 'node:path';

import expectedMetrics from '@/data/bilans/recipe/maths-terminale-v1-mock-metrics.json';
import reviewPacket from '@/data/bilans/recipe/maths-terminale-v1-mock-review-packet.json';
import { generateMockRecipeEvidence } from '@/scripts/bilans/generate-mock-recipe-evidence';

import { VALIDATED_PACK_FIXTURE as pack } from './fixtures/validated-pack';
import { RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

describe('mock technical recipe, twenty FactSheets by three audiences', () => {
  it('generates byte-identical versioned evidence twice without network', async () => {
    const originalModel = process.env.BILAN_LLM_MODEL;
    delete process.env.BILAN_LLM_MODEL;
    const fetchSpy = jest.spyOn(global, 'fetch');
    let first;
    let second;

    try {
      first = await generateMockRecipeEvidence(RECIPE_FACT_SHEETS, pack);
      second = await generateMockRecipeEvidence(RECIPE_FACT_SHEETS, pack);
    } finally {
      if (originalModel === undefined) delete process.env.BILAN_LLM_MODEL;
      else process.env.BILAN_LLM_MODEL = originalModel;
      fetchSpy.mockRestore();
    }

    const [versionedMetrics, versionedReviewPacket] = await Promise.all([
      readFile(path.join(process.cwd(), 'data/bilans/recipe/maths-terminale-v1-mock-metrics.json'), 'utf8'),
      readFile(path.join(process.cwd(), 'data/bilans/recipe/maths-terminale-v1-mock-review-packet.json'), 'utf8'),
    ]);

    expect(first.metricsJson).toBe(second.metricsJson);
    expect(first.reviewPacketJson).toBe(second.reviewPacketJson);
    expect(first.metricsJson).toBe(versionedMetrics);
    expect(first.reviewPacketJson).toBe(versionedReviewPacket);
    expect(first.metrics).toEqual(expectedMetrics);
    expect(first.reviewPacket).toEqual(reviewPacket);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(first.requests)).not.toMatch(/Camille|@/);
    expect(first.metrics.validationViolations.V2).toBe(0);
    expect(first.metrics.validationViolations.V6).toBe(0);
    expect(first.reviewPacket.reports).toHaveLength(60);
  });
});
