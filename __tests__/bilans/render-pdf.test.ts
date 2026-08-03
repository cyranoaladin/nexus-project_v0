import { ENTRY_RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import {
  extractPdfText,
  normalizePdfForComparison,
  renderDeterministicBilanPdf,
} from '@/lib/bilans/render/pdf';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';

const identity: RenderIdentity = {
  displayName: 'ELEVE_FIXTURE',
  level: 'TERMINALE',
  subject: 'MATHS',
  date: '2026-08-03',
  stageLabel: 'Stage de pré-rentrée — Entrée en Terminale, Mathématiques',
};

function contaminatedFactSheet(): FactSheet {
  const source = JSON.parse(JSON.stringify(ENTRY_RECIPE_FACT_SHEETS[0])) as FactSheet & Record<string, unknown>;
  source.isCorrect = '__CORRECT__';
  source.explanation = '__RATIONALE__';
  source.distractorRationale = '__RATIONALE__';
  source.correctAnswer = '__CORRECT__';
  source.packSlug = 'entree-terminale-maths-v1';
  const domain = source.domains[0] as typeof source.domains[number] & Record<string, unknown>;
  domain.isCorrect = '__CORRECT__';
  domain.distractorRationale = '__RATIONALE__';
  return source;
}

describe('A90.2.3 deterministic HTML-to-PDF export', () => {
  jest.setTimeout(60_000);

  it.each(['ELEVE', 'PARENTS'] as const)('keeps private sentinels, scores and slugs out of the %s PDF text', async (audience) => {
    const result = await renderDeterministicBilanPdf(contaminatedFactSheet(), audience, identity);

    expect(result.status).toBe('AVAILABLE');
    if (result.status !== 'AVAILABLE') throw new Error(result.errorCode);
    expect(result.pdf.subarray(0, 4).toString()).toBe('%PDF');
    const text = await extractPdfText(result.pdf);
    expect(text).toContain(identity.stageLabel);
    for (const forbidden of [
      '__CORRECT__', '__RATIONALE__', 'isCorrect', 'explanation',
      'distractorRationale', 'correctAnswer', 'globalScore', 'domainScores',
      'calibrationIndex', 'entree-terminale-maths-v1',
    ]) {
      expect(text).not.toContain(forbidden);
    }
    expect(text).not.toMatch(/\bscore\b/i);
  });

  it('is byte-stable once PDF timestamps and document identifiers are neutralized', async () => {
    const first = await renderDeterministicBilanPdf(ENTRY_RECIPE_FACT_SHEETS[0], 'ELEVE', identity);
    const second = await renderDeterministicBilanPdf(ENTRY_RECIPE_FACT_SHEETS[0], 'ELEVE', identity);
    if (first.status !== 'AVAILABLE' || second.status !== 'AVAILABLE') throw new Error('PDF_UNAVAILABLE');

    expect(normalizePdfForComparison(first.pdf)).toEqual(normalizePdfForComparison(second.pdf));
  });

  it('keeps HTML available and marks PDF unavailable when the shared engine fails', async () => {
    const result = await renderDeterministicBilanPdf(
      ENTRY_RECIPE_FACT_SHEETS[0],
      'PARENTS',
      identity,
      { renderHtmlToPdf: async () => { throw new Error('CHROMIUM_DOWN'); } },
    );

    expect(result).toEqual(expect.objectContaining({
      status: 'UNAVAILABLE',
      errorCode: 'BILAN_PDF_RENDER_FAILED',
    }));
    expect(result.html).toContain(identity.stageLabel);
    expect(result).not.toHaveProperty('pdf');
  });
});
