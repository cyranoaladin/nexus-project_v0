import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';
import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import { buildQuestionEvidence } from '@/lib/bilans/render/question-evidence';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import { buildPreRentreeStageLabel } from '@/lib/bilans/render/stage-label';
import { frenchTypography } from '@/lib/bilans/render/typography';
import { buildRecipeFactSheets } from './fixtures/recipe-fact-sheets';

const PACK_PATH = 'data/bilans/banks/entree-terminale-maths-complementaires-v1.json';
const ITEM_ID = 'ETL-MCO-PRO-02';
const SAFE_OPTION_TEXT = 'Oui : la probabilité qu’elle soit porteuse est d’environ 59,5 %';
const SAFE_CORRECTION = 'Par la formule de Bayes, P(porteur | test positif) = 0,03 × 0,95 / (0,03 × 0,95 + 0,97 × 0,02) ≈ 59,5 %. Une personne testée positive est donc probablement porteuse.';
const FORBIDDEN_HUMAN_TEXT = [
  /Non\s*(?::|&nbsp;:)\s*la probabilité[^<\n]*59/iu,
  /clé papier/iu,
  /mot\s+(?:«\s*)?Non/iu,
  /du PDF/iu,
  /incohérent/iu,
] as const;

function evidenceFor(optionId: 'A' | 'B') {
  return buildQuestionEvidence(PACK, {
    [ITEM_ID]: { optionId, confidence: 4 },
  });
}

const PACK = loadBilanPack(PACK_PATH);
const FACT_SHEET = buildRecipeFactSheets(PACK.scoring.domains, 'TERMINALE')[0];
const IDENTITY: RenderIdentity = {
  displayName: 'ELEVE_ETL',
  level: 'TERMINALE',
  subject: 'MATHS_COMPLEMENTAIRES',
  date: '2026-08-23',
  stageLabel: buildPreRentreeStageLabel('TERMINALE', 'MATHS_COMPLEMENTAIRES'),
};

describe('Mathématiques complémentaires — projection humaine de ETL-MCO-PRO-02', () => {
  it('conserve B comme unique option correcte dans le pack validé brut', () => {
    expect(PACK.status).toBe('VALIDATED');
    const bankItem = PACK.questionnaire.items.find(({ id }) => id === ITEM_ID);
    expect(bankItem).toBeDefined();
    expect(bankItem!.options.find(({ id }) => id === 'B')?.text).toMatch(/^Non\s*:/);
    expect(bankItem!.shortCorrection).toContain('clé papier');
    expect(bankItem!.options.filter(({ isCorrect }) => isCorrect)).toEqual([
      expect.objectContaining({ id: 'B', isCorrect: true }),
    ]);
  });

  it.each([
    ['B choisie', evidenceFor('B')],
    ['A choisie et B attendue', evidenceFor('A')],
  ])('projette un texte sûr quand %s sans modifier l’identité canonique', (_case, evidence) => {
    const item = evidence.items.find(({ itemId }) => itemId === ITEM_ID);
    expect(item).toBeDefined();
    expect(item!.options.find(({ id }) => id === 'B')).toEqual(expect.objectContaining({
      id: 'B',
      text: SAFE_OPTION_TEXT,
      isCorrect: true,
    }));
    expect(item!.shortCorrection).toBe(SAFE_CORRECTION);
    expect(item!.options.map(({ id }) => id)).toEqual(
      PACK.questionnaire.items.find(({ id }) => id === ITEM_ID)!.options.map(({ id }) => id),
    );
    expect(Object.isFrozen(item)).toBe(true);
    expect(Object.isFrozen(item!.options)).toBe(true);

    for (const audience of ['ELEVE', 'PARENTS', 'NEXUS'] as const) {
      const html = renderDeterministicBilanHtml(FACT_SHEET, audience, IDENTITY, undefined, evidence);
      for (const forbidden of FORBIDDEN_HUMAN_TEXT) expect(html).not.toMatch(forbidden);
      expect(html).not.toMatch(/ETL-MCO-/u);
      if (audience === 'PARENTS') {
        expect(html).not.toContain(SAFE_OPTION_TEXT);
      } else {
        expect(html).toContain(frenchTypography(SAFE_OPTION_TEXT));
        expect(html).toContain(frenchTypography(SAFE_CORRECTION));
      }
    }
  });

  it('masque l’identifiant technique ETL-MCO dans la synthèse humaine Nexus', () => {
    const html = renderDeterministicBilanHtml(
      FACT_SHEET,
      'NEXUS',
      IDENTITY,
      undefined,
      evidenceFor('A'),
    );

    expect(html).not.toContain(ITEM_ID);
    expect(html).not.toMatch(/ETL-MCO-/u);
  });
});
