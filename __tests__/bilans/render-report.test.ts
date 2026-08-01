import { buildDeterministicReport } from '@/lib/bilans/render/report';
import { BilanLlmGateway } from '@/lib/bilans/llm/gateway';
import { MockBilanLlmTransport } from '@/lib/bilans/llm/mock-transport';
import { createPseudonymizedFactSheet } from '@/lib/bilans/local-first/contracts';

import { VALIDATED_PACK_FIXTURE as pack } from './fixtures/validated-pack';
import { RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

describe('FactSheet-only deterministic numeric rendering', () => {
  it('keeps raw scores out of student and parent content while rendering every domain', async () => {
    const sheet = RECIPE_FACT_SHEETS[0];
    const result = await new BilanLlmGateway(new MockBilanLlmTransport())
      .run(createPseudonymizedFactSheet(sheet), pack);
    expect(result.bundle).not.toBeNull();

    for (const audience of ['ELEVE', 'PARENTS'] as const) {
      const report = buildDeterministicReport(sheet, result.bundle!, audience);
      expect(report.content.domains.map(({ id }) => id)).toEqual(sheet.domains.map(({ id }) => id));
      expect(report.content).not.toHaveProperty('internalFacts');
      expect(JSON.stringify(report.content)).not.toMatch(/"(globalScore|coverage|calibrationIndex|score)"/);
    }
  });

  it('inserts internal numeric facts from the FactSheet, never from agent prose', async () => {
    const sheet = RECIPE_FACT_SHEETS[1];
    const result = await new BilanLlmGateway(new MockBilanLlmTransport())
      .run(createPseudonymizedFactSheet(sheet), pack);
    const report = buildDeterministicReport(sheet, result.bundle!, 'NEXUS');

    expect(report.content.internalFacts).toEqual({
      globalScore: sheet.globalScore,
      coverage: sheet.coverage,
      calibrationIndex: sheet.calibrationIndex,
      domainScores: sheet.domains.map(({ id, score }) => ({ id, score })),
    });
  });
});
