import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';
import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import {
  buildQuestionEvidence,
  chosenOption,
  confidenceLabel,
  correctOption,
  evidenceItemStatus,
  meanConfidenceByDomain,
} from '@/lib/bilans/render/question-evidence';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import { frenchTypography } from '@/lib/bilans/render/typography';
import { buildPreRentreeStageLabel } from '@/lib/bilans/render/stage-label';
import { PREMIERE_ENTRY_RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

const PACK_PATH = 'data/bilans/banks/entree-premiere-maths-v1.json';

function loadPack() {
  return loadBilanPack(PACK_PATH);
}

function demonstrationAnswers(pack: ReturnType<typeof loadPack>) {
  const answers: Record<string, { optionId: string; confidence: 1 | 2 | 3 | 4 | null }> = {};
  const items = pack.questionnaire.items;
  // Premier item : bonne réponse sûre ; deuxième : mauvaise réponse sûre ;
  // troisième : sans confiance ; les autres restent non traités.
  const [first, second, third] = items;
  const correctOf = (item: typeof first) => item.options.find(({ isCorrect }) => isCorrect)!;
  const wrongOf = (item: typeof first) => item.options.find(({ isCorrect }) => !isCorrect)!;
  answers[first.id] = { optionId: correctOf(first).id, confidence: 4 };
  answers[second.id] = { optionId: wrongOf(second).id, confidence: 4 };
  answers[third.id] = { optionId: correctOf(third).id, confidence: null };
  return answers;
}

describe('Détail des réponses — question-evidence', () => {
  const pack = loadPack();
  const answers = demonstrationAnswers(pack);
  const evidence = buildQuestionEvidence(pack, answers);

  it('projette chaque item du pack, en lecture seule, avec la réponse de l’élève', () => {
    expect(evidence.items).toHaveLength(pack.questionnaire.items.length);
    const [first, second, third, fourth] = evidence.items;

    expect(evidenceItemStatus(first)).toBe('JUSTE');
    expect(chosenOption(first)?.isCorrect).toBe(true);
    expect(first.confidence).toBe(4);

    expect(evidenceItemStatus(second)).toBe('A_REVOIR');
    expect(chosenOption(second)?.isCorrect).toBe(false);
    expect(chosenOption(second)?.distractorRationale).toBeTruthy();
    expect(correctOption(second)?.isCorrect).toBe(true);

    expect(evidenceItemStatus(third)).toBe('JUSTE');
    expect(third.confidence).toBeNull();

    expect(evidenceItemStatus(fourth)).toBe('NON_TRAITE');
    expect(chosenOption(fourth)).toBeNull();
  });

  it('porte les libellés officiels de certitude du pack', () => {
    expect(evidence.confidenceLabels).toEqual(['je devine', 'peu sûr', 'plutôt sûr', 'certain']);
    expect(confidenceLabel(evidence, 1)).toBe('je devine');
    expect(confidenceLabel(evidence, 4)).toBe('certain');
    expect(confidenceLabel(evidence, null)).toBeNull();
  });

  it('calcule la confiance moyenne par domaine pour la calibration Nexus', () => {
    const means = meanConfidenceByDomain(evidence);
    const firstDomain = evidence.items[0].domainId;
    expect(means.get(firstDomain)).toBeGreaterThanOrEqual(1);
    const untouchedDomain = evidence.items[evidence.items.length - 1].domainId;
    if (untouchedDomain !== firstDomain) {
      expect(means.get(untouchedDomain)).toBeNull();
    }
  });

  it('reste totalement déterministe', () => {
    const again = buildQuestionEvidence(pack, answers);
    expect(JSON.stringify(again)).toBe(JSON.stringify(evidence));
  });
});

describe('Détail des réponses — rendu par audience', () => {
  const pack = loadPack();
  const evidence = buildQuestionEvidence(pack, demonstrationAnswers(pack));
  const factSheet = PREMIERE_ENTRY_RECIPE_FACT_SHEETS[0];
  const identity: RenderIdentity = {
    displayName: 'ELEVE_EVIDENCE',
    level: 'PREMIERE',
    subject: 'MATHS',
    date: '2026-08-12',
    stageLabel: buildPreRentreeStageLabel('PREMIERE', 'MATHS'),
  };

  it('rend la section détaillée pour l’élève : énoncé, réponse, correction, certitude', () => {
    const html = renderDeterministicBilanHtml(factSheet, 'ELEVE', identity, undefined, evidence);
    expect(html).toContain('Le détail de tes réponses');
    const [first, second] = evidence.items;
    expect(html).toContain('Développer et réduire');
    expect(html).toContain('Réponse donnée');
    expect(html).toContain('Réponse attendue');
    expect(html).toContain('D’où vient l’erreur');
    expect(html).toContain('Ce qu’il faut retenir');
    expect(html).toContain('certain');
    expect(html).toContain('non traitée');
    // Jamais d'identifiant technique d'item côté élève.
    expect(html).not.toContain(first.itemId);
    expect(html).not.toContain(second.itemId);
    // Jamais le slug technique du pack.
    expect(html).not.toContain(evidence.packSlug);
  });

  it('rend le relevé intégral pour Nexus, avec identifiants d’items', () => {
    const html = renderDeterministicBilanHtml(factSheet, 'NEXUS', identity, undefined, evidence);
    expect(html).toContain('Détail des réponses');
    expect(html).toContain(evidence.items[0].itemId);
    expect(html).toContain(frenchTypography('Calibration : réussite × confiance déclarée'));
  });

  it('n’expose jamais le détail question par question aux parents', () => {
    const html = renderDeterministicBilanHtml(factSheet, 'PARENTS', identity, undefined, evidence);
    expect(html).not.toContain('Développer et réduire');
    expect(html).not.toContain('Réponse donnée');
    expect(html).toContain('Le détail question par question figure dans le document remis à votre enfant');
  });

  it('rend le document sans section détail quand l’évidence est absente', () => {
    const html = renderDeterministicBilanHtml(factSheet, 'ELEVE', identity);
    expect(html).not.toContain('Le détail de tes réponses');
    expect(html).toContain('Ton parcours pendant le stage');
  });
});
