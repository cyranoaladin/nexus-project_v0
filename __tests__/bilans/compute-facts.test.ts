/**
 * Suite unitaire du moteur de positionnement.
 * Spec : docs/specs/bilans/06-plan-de-tests.md §1
 *
 * Objectif de couverture : 100 % de branches sur lib/bilans/facts/compute-facts.ts.
 * Ce fichier ne doit jamais nécessiter de base de données ni de réseau.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CONFIDENCE_THRESHOLD,
  ENGINE_VERSION,
  SUCCESS_THRESHOLD,
} from '@/lib/bilans/facts/constants';
import {
  computeGroupBand,
  computeItemProfile,
  computeNodeProfile,
  computeRawSuccess,
  normalizeText,
  score,
} from '@/lib/bilans/facts/compute-facts';
import type {
  Difficulty,
  ItemProfile,
  ScoringInput,
  ScoringItem,
} from '@/lib/bilans/facts/types';

/* -------------------------------------------------------------------------- */
/* Cas dorés — contractuels                                                    */
/* -------------------------------------------------------------------------- */

const golden = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/golden-cases.json'), 'utf8'),
) as {
  engineVersion: string;
  cases: Record<string, { description: string; input: ScoringInput; expected: unknown }>;
};

describe('cas dorés', () => {
  it("l'ENGINE_VERSION du code correspond à celle des fixtures", () => {
    // Si ce test échoue, régénérer les fixtures ET justifier en ADR.
    expect(ENGINE_VERSION).toBe(golden.engineVersion);
  });

  for (const [name, c] of Object.entries(golden.cases)) {
    it(`${name} — ${c.description}`, () => {
      expect(score(c.input)).toEqual(c.expected);
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Réussite par type d'item — spec 02 §2                                       */
/* -------------------------------------------------------------------------- */

const mkItem = (over: Partial<ScoringItem> & Pick<ScoringItem, 'answerKey' | 'type'>): ScoringItem => ({
  id: 'X',
  nodeCpsId: 'n',
  difficulty: 1,
  targetTimeSec: 60,
  ...over,
});

describe('computeRawSuccess', () => {
  it('QCM_SIMPLE : 1 si la clé correspond, 0 sinon', () => {
    const item = mkItem({ type: 'QCM_SIMPLE', answerKey: { kind: 'QCM_SIMPLE', correct: 'B' } });
    expect(computeRawSuccess(item, 'B')).toBe(1);
    expect(computeRawSuccess(item, 'A')).toBe(0);
  });

  it('QCM_MULTIPLE : crédit partiel, pénalité sur les fausses, arrondi au quart', () => {
    const item = mkItem({
      type: 'QCM_MULTIPLE',
      answerKey: { kind: 'QCM_MULTIPLE', correct: ['A', 'B'] },
    });
    expect(computeRawSuccess(item, ['A', 'B'])).toBe(1);
    expect(computeRawSuccess(item, ['A'])).toBe(0.5);
    expect(computeRawSuccess(item, ['A', 'C'])).toBe(0); // 1 juste - 1 fausse = 0
    expect(computeRawSuccess(item, ['C', 'D'])).toBe(0); // jamais négatif
    expect(computeRawSuccess(item, ['A', 'A'])).toBe(0.5); // doublon ignoré
  });

  it('QCM_MULTIPLE : récupère explicitement une sélection scalaire corrompue comme un choix unique', () => {
    const item = mkItem({
      type: 'QCM_MULTIPLE',
      answerKey: { kind: 'QCM_MULTIPLE', correct: ['A', 'B'] },
    });
    expect(computeRawSuccess(item, 'A')).toBe(0.5);
  });

  it('QCM_MULTIPLE : échoue fermé à zéro si la donnée corrompue ne déclare aucune bonne option', () => {
    const item = mkItem({
      type: 'QCM_MULTIPLE',
      answerKey: { kind: 'QCM_MULTIPLE', correct: [] },
    });
    expect(computeRawSuccess(item, ['A'])).toBe(0);
  });

  it('refuse explicitement un type de clé inconnu au lieu de retourner une valeur plausible', () => {
    const item = mkItem({
      type: 'QCM_SIMPLE',
      answerKey: { kind: 'CORRUPTED' } as unknown as ScoringItem['answerKey'],
    });
    expect(() => computeRawSuccess(item, 'A')).toThrow('Unsupported answer key kind: CORRUPTED');
  });

  it('NUMERIC : tolérance appliquée, virgule décimale acceptée', () => {
    const item = mkItem({
      type: 'NUMERIC',
      answerKey: { kind: 'NUMERIC', target: 12, tolerance: 0.5 },
    });
    expect(computeRawSuccess(item, 12)).toBe(1);
    expect(computeRawSuccess(item, 12.5)).toBe(1);
    expect(computeRawSuccess(item, 12.6)).toBe(0);
    expect(computeRawSuccess(item, '11,7')).toBe(1);
    expect(computeRawSuccess(item, 'douze')).toBe(0);
  });

  it('SHORT_TEXT : comparaison après normalisation', () => {
    const item = mkItem({
      type: 'SHORT_TEXT',
      answerKey: { kind: 'SHORT_TEXT', accepted: ['Théorème de Thalès'] },
    });
    expect(computeRawSuccess(item, 'theoreme de thales')).toBe(1);
    expect(computeRawSuccess(item, '  Théorème   de Thalès.  ')).toBe(1);
    expect(computeRawSuccess(item, 'Pythagore')).toBe(0);
    expect(computeRawSuccess(item, 42)).toBe(0);
  });

  it('non-réponse : 0 quel que soit le type', () => {
    const item = mkItem({ type: 'QCM_SIMPLE', answerKey: { kind: 'QCM_SIMPLE', correct: 'B' } });
    expect(computeRawSuccess(item, null)).toBe(0);
    expect(computeRawSuccess(item, undefined)).toBe(0);
    expect(computeRawSuccess(item, '')).toBe(0);
    expect(computeRawSuccess(item, [])).toBe(0);
  });
});

describe('normalizeText', () => {
  it('supprime accents, casse, espaces multiples et ponctuation finale', () => {
    expect(normalizeText('  Éléve   Rapide !! ')).toBe('eleve rapide');
  });
});

/* -------------------------------------------------------------------------- */
/* Profils et frontières — spec 02 §3, §4                                      */
/* -------------------------------------------------------------------------- */

describe('frontières des seuils', () => {
  it('SUCCESS_THRESHOLD : 0,5 échoue, 0,75 réussit', () => {
    expect(0.5 >= SUCCESS_THRESHOLD).toBe(false);
    expect(0.75 >= SUCCESS_THRESHOLD).toBe(true);
  });

  it('CONFIDENCE_THRESHOLD : 2 est bas, 3 est haut', () => {
    expect(2 >= CONFIDENCE_THRESHOLD).toBe(false);
    expect(3 >= CONFIDENCE_THRESHOLD).toBe(true);
  });
});

describe('computeItemProfile — matrice complète', () => {
  const table: Array<[boolean, boolean, boolean, ItemProfile]> = [
    [true, true, true, 'MAITRISE'],
    [true, true, false, 'MAITRISE_FRAGILE'],
    [true, false, true, 'ERREUR_CONFIANTE'],
    [true, false, false, 'LACUNE_CONSCIENTE'],
    [false, false, false, 'NON_TRAITE'],
    [false, true, true, 'NON_TRAITE'],
  ];
  it.each(table)(
    'answered=%s success=%s confident=%s → %s',
    (answered, success, confident, expected) => {
      expect(computeItemProfile(answered, success, confident)).toBe(expected);
    },
  );
});

/* -------------------------------------------------------------------------- */
/* Profil de nœud — spec 02 §6, y compris les égalités exactes                 */
/* -------------------------------------------------------------------------- */

const mass = (o: Partial<Record<ItemProfile, number>>): Record<ItemProfile, number> => ({
  MAITRISE: 0,
  MAITRISE_FRAGILE: 0,
  LACUNE_CONSCIENTE: 0,
  ERREUR_CONFIANTE: 0,
  NON_TRAITE: 0,
  ...o,
});

describe('computeNodeProfile', () => {
  it('nœud vide → NON_TRAITE', () => {
    expect(computeNodeProfile(mass({}))).toBe('NON_TRAITE');
  });

  it('règle 1 : plus de la moitié non traitée', () => {
    expect(computeNodeProfile(mass({ NON_TRAITE: 3, MAITRISE: 2 }))).toBe('NON_TRAITE');
  });

  it('règle 2 : une difficulté entièrement issue du non-traité reste NON_TRAITE', () => {
    // NT/W == 0.5, sans erreur confiante ni lacune consciente.
    expect(computeNodeProfile(mass({ NON_TRAITE: 2, MAITRISE: 2 }))).toBe('NON_TRAITE');
  });

  it('règle 2 : égalité m_EC == m_LC tranche en faveur de ERREUR_CONFIANTE', () => {
    expect(computeNodeProfile(mass({ ERREUR_CONFIANTE: 2, LACUNE_CONSCIENTE: 2 }))).toBe(
      'ERREUR_CONFIANTE',
    );
  });

  it('règle 2 : lacune consciente majoritaire', () => {
    expect(
      computeNodeProfile(mass({ ERREUR_CONFIANTE: 1, LACUNE_CONSCIENTE: 3, MAITRISE: 1 })),
    ).toBe('LACUNE_CONSCIENTE');
  });

  it('règle 3 : égalité m_M == m_MF tranche en faveur de MAITRISE', () => {
    expect(computeNodeProfile(mass({ MAITRISE: 2, MAITRISE_FRAGILE: 2 }))).toBe('MAITRISE');
  });

  it('règle 3 : fragilité majoritaire', () => {
    expect(computeNodeProfile(mass({ MAITRISE: 1, MAITRISE_FRAGILE: 3 }))).toBe('MAITRISE_FRAGILE');
  });
});

/* -------------------------------------------------------------------------- */
/* Bandes de groupe — spec 02 §10, bornes exactes                              */
/* -------------------------------------------------------------------------- */

describe('computeGroupBand', () => {
  it.each([
    [0, 'CONSOLIDATION_PRIORITAIRE'],
    [39.9, 'CONSOLIDATION_PRIORITAIRE'],
    [40, 'CONSOLIDATION_STANDARD'],
    [64.9, 'CONSOLIDATION_STANDARD'],
    [65, 'RENFORCEMENT'],
    [84.9, 'RENFORCEMENT'],
    [85, 'APPROFONDISSEMENT'],
    [100, 'APPROFONDISSEMENT'],
  ])('%s → %s', (s, band) => {
    expect(computeGroupBand(s as number)).toBe(band);
  });
});

/* -------------------------------------------------------------------------- */
/* Priorisation : tie-break déterministe — spec 02 §9                          */
/* -------------------------------------------------------------------------- */

describe('priorisation', () => {
  it('deux nœuds strictement équivalents sont ordonnés par nodeCpsId croissant', () => {
    const base = {
      type: 'QCM_SIMPLE' as const,
      difficulty: 1 as Difficulty,
      targetTimeSec: 60,
      answerKey: { kind: 'QCM_SIMPLE' as const, correct: 'A' },
      nodeCriticality: 1,
    };
    const input: ScoringInput = {
      targetDurationMin: 1,
      items: [
        { ...base, id: 'a1', nodeCpsId: 'zeta' },
        { ...base, id: 'a2', nodeCpsId: 'zeta' },
        { ...base, id: 'b1', nodeCpsId: 'alpha' },
        { ...base, id: 'b2', nodeCpsId: 'alpha' },
      ],
      answers: [
        { itemId: 'a1', rawAnswer: 'B', confidence: 4, elapsedMs: 1000 },
        { itemId: 'a2', rawAnswer: 'B', confidence: 4, elapsedMs: 1000 },
        { itemId: 'b1', rawAnswer: 'B', confidence: 4, elapsedMs: 1000 },
        { itemId: 'b2', rawAnswer: 'B', confidence: 4, elapsedMs: 1000 },
      ],
    };
    expect(score(input).nodes.map((n) => n.nodeCpsId)).toEqual(['alpha', 'zeta']);
  });
});

describe('branches défensives du moteur', () => {
  it('retourne des agrégats nuls pour une banque vide', () => {
    const result = score({ items: [], answers: [], targetDurationMin: 0 });
    expect(result.globalScore).toBe(0);
    expect(result.coverage).toBe(0);
    expect(result.nodes).toEqual([]);
  });

  it('reste fail-closed si une difficulté nulle corrompue atteint les agrégats', () => {
    const item = mkItem({
      id: 'ZERO',
      nodeCpsId: 'node.zero',
      type: 'QCM_SIMPLE',
      difficulty: 0 as unknown as Difficulty,
      answerKey: { kind: 'QCM_SIMPLE', correct: 'A' },
    });
    const result = score({
      items: [item],
      answers: [{ itemId: item.id, rawAnswer: 'A', confidence: 4, elapsedMs: 60_000 }],
      targetDurationMin: 1,
    });
    expect(result.globalScore).toBe(0);
    expect(result.nodes[0]).toMatchObject({ nodeScore: 0, criticality: 1 });
  });

  it('conserve le drapeau explicite de passation partielle', () => {
    const result = score({ ...golden.cases['mixed-realistic'].input, partial: true });
    expect(result.flags).toContain('PASSATION_PARTIELLE');
  });
});

/* -------------------------------------------------------------------------- */
/* Propriétés — spec 06 §1.3                                                   */
/* -------------------------------------------------------------------------- */

describe('propriétés', () => {
  const ref = golden.cases['mixed-realistic'].input;

  it('déterminisme : 100 exécutions identiques', () => {
    const first = JSON.stringify(score(ref));
    for (let i = 0; i < 100; i += 1) {
      expect(JSON.stringify(score(ref))).toBe(first);
    }
  });

  it("invariance à l'ordre du tableau answers", () => {
    const reversed: ScoringInput = { ...ref, answers: [...ref.answers].reverse() };
    expect(score(reversed)).toEqual(score(ref));
  });

  it('bornes : tous les indicateurs restent dans [0, 100]', () => {
    for (const c of Object.values(golden.cases)) {
      const out = score(c.input);
      for (const v of [out.globalScore, out.coverage, ...out.nodes.map((n) => n.nodeScore)]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      if (out.calibrationIndex !== null) {
        expect(out.calibrationIndex).toBeGreaterThanOrEqual(0);
        expect(out.calibrationIndex).toBeLessThanOrEqual(100);
      }
    }
  });

  it('monotonie : corriger une réponse ne fait jamais baisser le score global', () => {
    const wrong = golden.cases['all-wrong-confident'].input;
    const right = golden.cases['all-correct-confident'].input;
    let previous = score(wrong).globalScore;
    for (let i = 0; i < wrong.answers.length; i += 1) {
      const answers = wrong.answers.map((a, idx) => (idx <= i ? right.answers[idx] : a));
      const current = score({ ...wrong, answers }).globalScore;
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Garde-fou : aucune dépendance réseau — spec 06 §1.3                         */
/* -------------------------------------------------------------------------- */

describe('isolation du moteur', () => {
  it('scoring.ts n’importe ni client HTTP ni SDK de modèle', () => {
    const src = readFileSync(
      join(__dirname, '../../lib/bilans/facts/compute-facts.ts'),
      'utf8',
    );
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    for (const forbidden of ['fetch(', 'axios', 'openai', 'ollama', 'prisma', 'Math.random(', 'Date.now(']) {
      expect(code).not.toContain(forbidden);
    }
  });
});
