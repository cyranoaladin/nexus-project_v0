import { buildDeterministicReport } from '@/lib/bilans/render/report';
import { RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

describe('FactSheet-only deterministic numeric rendering', () => {
  it('keeps raw scores out of student and parent content while rendering every domain', () => {
    const sheet = RECIPE_FACT_SHEETS[0];

    for (const audience of ['ELEVE', 'PARENTS'] as const) {
      const report = buildDeterministicReport(sheet, audience);
      expect(report.content.domains.map(({ id }) => id)).toEqual(sheet.domains.map(({ id }) => id));
      expect(report.content).not.toHaveProperty('internalFacts');
      expect(JSON.stringify(report.content)).not.toMatch(/"(globalScore|coverage|calibrationIndex|score)"/);
    }
  });

  it('inserts internal numeric facts from the FactSheet without an agent bundle', () => {
    const sheet = RECIPE_FACT_SHEETS[1];
    const report = buildDeterministicReport(sheet, 'NEXUS');

    expect(report.content.internalFacts).toEqual({
      globalScore: sheet.globalScore,
      coverage: sheet.coverage,
      calibrationIndex: sheet.calibrationIndex,
      domainScores: sheet.domains.map(({ id, score }) => ({ id, score })),
    });
  });

  it('is byte-for-byte deterministic for the same FactSheet', () => {
    const sheet = RECIPE_FACT_SHEETS[2];
    expect(JSON.stringify(buildDeterministicReport(sheet, 'ELEVE')))
      .toBe(JSON.stringify(buildDeterministicReport(sheet, 'ELEVE')));
  });
});
