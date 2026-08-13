/**
 * L'absence de réponse est SAISISSABLE et correctement interprétée.
 *
 * Avant : la grille refusait de valider un item vide et l'API rejetait
 * `optionId: null` — l'assistante ne pouvait pas déclarer qu'un élève n'avait
 * pas répondu, alors que le moteur profile NON_TRAITE depuis toujours.
 * Désormais : « sans réponse » est un état déclaré (jamais une omission
 * silencieuse), sans certitude inventée, profilé NON_TRAITE de bout en bout.
 */

import { assertAttemptComplete } from '@/lib/bilans/api/submission-core';
import { buildPaperEntryAnswers } from '@/lib/bilans/saisie-papier/entry';
import { score } from '@/lib/bilans/facts/compute-facts';
import type { ScoringItem } from '@/lib/bilans/facts/types';

const PACK = {
  pack: {
    questionnaire: {
      items: [
        { id: 'Q1', options: [{ id: 'A' }, { id: 'B' }] },
        { id: 'Q2', options: [{ id: 'A' }, { id: 'B' }] },
      ],
    },
  },
} as never;

describe('buildPaperEntryAnswers — non-réponse déclarée', () => {
  it('accepte optionId null sans certitude', () => {
    const answers = buildPaperEntryAnswers(PACK, [
      { itemId: 'Q1', optionId: 'A', confidence: 4 },
      { itemId: 'Q2', optionId: null, confidence: null },
    ]);
    expect(answers.Q2).toMatchObject({ optionId: null });
  });

  it('refuse une certitude sur une non-réponse — on n’invente pas une donnée', () => {
    expect(() => buildPaperEntryAnswers(PACK, [
      { itemId: 'Q1', optionId: null, confidence: 3 },
    ])).toThrow('PAPER_ENTRY_BLANK_WITH_CONFIDENCE');
  });
});

describe('assertAttemptComplete — déclaré ≠ omis', () => {
  it('une non-réponse DÉCLARÉE est une saisie complète', () => {
    expect(() => assertAttemptComplete({
      Q1: { optionId: 'A', confidence: 2 },
      Q2: { optionId: null, confidence: null },
    }, PACK)).not.toThrow();
  });

  it('un item ABSENT de la requête reste incomplet — pas d’omission silencieuse', () => {
    expect(() => assertAttemptComplete({
      Q1: { optionId: 'A', confidence: 2 },
    }, PACK)).toThrow('ATTEMPT_INCOMPLETE');
  });

  it('une non-réponse assortie d’une certitude reste incomplète', () => {
    expect(() => assertAttemptComplete({
      Q1: { optionId: 'A', confidence: 2 },
      Q2: { optionId: null, confidence: 4 },
    }, PACK)).toThrow('ATTEMPT_INCOMPLETE');
  });
});

describe('propagation moteur — la non-réponse est un NON_TRAITE, pas un zéro muet', () => {
  const item = (id: string, node: string): ScoringItem => ({
    id, nodeCpsId: node, difficulty: 1, targetTimeSec: 60,
    type: 'QCM_SIMPLE', answerKey: { kind: 'QCM_SIMPLE', correct: 'A' },
  });

  it('couverture et calibration reflètent les items réellement traités', () => {
    const output = score({
      items: [item('Q1', 'n1'), item('Q2', 'n1'), item('Q3', 'n2'), item('Q4', 'n2')],
      answers: [
        { itemId: 'Q1', rawAnswer: 'A', confidence: 4, elapsedMs: 30_000 },
        { itemId: 'Q2', rawAnswer: null, confidence: null, elapsedMs: 0 },
        // Q3/Q4 : rien — non traités.
      ],
      targetDurationMin: 4,
    });
    expect(output.coverage).toBe(25);
    // La calibration ne porte que sur l'item traité (concordant) : 100.
    expect(output.calibrationIndex).toBe(100);
    // n2 entièrement non traité → NON_TRAITE ; n1 à moitié → plafonné fragile.
    const byNode = new Map(output.nodes.map((n) => [n.nodeCpsId, n.profile]));
    expect(byNode.get('n2')).toBe('NON_TRAITE');
    expect(byNode.get('n1')).toBe('MAITRISE_FRAGILE');
  });

  it('aucun test entièrement traité ne peut produire un domaine « acquis » partiellement inconnu', () => {
    const output = score({
      items: [item('Q1', 'n1'), item('Q2', 'n1'), item('Q3', 'n1'), item('Q4', 'n1')],
      answers: [
        { itemId: 'Q1', rawAnswer: 'A', confidence: 4, elapsedMs: 30_000 },
        { itemId: 'Q2', rawAnswer: 'A', confidence: 4, elapsedMs: 30_000 },
        { itemId: 'Q3', rawAnswer: 'A', confidence: 4, elapsedMs: 30_000 },
        { itemId: 'Q4', rawAnswer: null, confidence: null, elapsedMs: 0 },
      ],
      targetDurationMin: 4,
    });
    expect(output.nodes[0].profile).toBe('MAITRISE_FRAGILE');
    expect(output.nodes[0].profile).not.toBe('MAITRISE');
  });
});
