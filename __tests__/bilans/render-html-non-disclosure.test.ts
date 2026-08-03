import { ENTRY_RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
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

  const firstDomain = source.domains[0] as typeof source.domains[number] & Record<string, unknown>;
  firstDomain.isCorrect = '__CORRECT__';
  firstDomain.explanation = '__RATIONALE__';
  firstDomain.distractorRationale = '__RATIONALE__';
  return source;
}

describe('A90.2.2 serialized HTML non-disclosure', () => {
  it.each(['ELEVE', 'PARENTS'] as const)('removes recursive sentinels and private fields from %s', (audience) => {
    const factSheet = contaminatedFactSheet();
    const contaminatedJson = JSON.stringify(factSheet);
    expect(contaminatedJson).toContain('__CORRECT__');
    expect(contaminatedJson).toContain('__RATIONALE__');
    expect(contaminatedJson).toContain('entree-terminale-maths-v1');

    const html = renderDeterministicBilanHtml(factSheet, audience, identity);

    for (const forbidden of [
      '__CORRECT__',
      '__RATIONALE__',
      'isCorrect',
      'explanation',
      'distractorRationale',
      'correctAnswer',
      'globalScore',
      'domainScores',
      'calibrationIndex',
      'entree-terminale-maths-v1',
    ]) {
      expect(html).not.toContain(forbidden);
    }
    expect(html).not.toMatch(/\bscore\b/i);
  });
});
