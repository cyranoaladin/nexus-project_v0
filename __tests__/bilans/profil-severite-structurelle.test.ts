/**
 * La méthode est juste — pas seulement « ce cas est corrigé ».
 *
 * Vérification STRUCTURELLE de l'agrégation de profil, exigée après le défaut
 * du 13/08/2026 (un domaine avec un item faux à 4/4 présenté « acquis » aux
 * familles, absent des priorités et du plan de séances) :
 *
 *   1. combinatoire exhaustive au niveau des masses : AUCUNE combinaison de
 *      profils d'items ne peut produire un nœud « acquis » quand une erreur
 *      confiante ou une lacune consciente est présente ;
 *   2. combinatoire de bout en bout à travers `score()` : réponses réelles
 *      (justes/fausses × certitudes 1–4 × non traité), mêmes invariants,
 *      frontière de certitude (3) incluse ;
 *   3. héritage domaine ← pire nœud selon l'UNIQUE échelle `SEVERITY_RANK` —
 *      y compris l'ordre ERREUR_CONFIANTE > NON_TRAITE que le doublon
 *      d'échelle supprimé inversait ;
 *   4. architecture : aucune seconde échelle de sévérité ne peut réapparaître
 *      dans lib/bilans sans casser ce test.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { computeNodeProfile, score } from '@/lib/bilans/facts/compute-facts';
import { SEVERITY_RANK } from '@/lib/bilans/facts/constants';
import { buildFactSheet } from '@/lib/bilans/facts/fact-sheet';
import type { ItemProfile, ScoringItem } from '@/lib/bilans/facts/types';

const PROFILES: readonly ItemProfile[] = [
  'MAITRISE', 'MAITRISE_FRAGILE', 'LACUNE_CONSCIENTE', 'ERREUR_CONFIANTE', 'NON_TRAITE',
];

function expectedNodeProfile(mass: Record<ItemProfile, number>): ItemProfile {
  const total = PROFILES.reduce((s, p) => s + mass[p], 0);
  if (total === 0) return 'NON_TRAITE';
  if (mass.ERREUR_CONFIANTE > 0) return 'ERREUR_CONFIANTE';
  if (mass.NON_TRAITE / total > 0.5) return 'NON_TRAITE';
  if (mass.LACUNE_CONSCIENTE > 0) return 'LACUNE_CONSCIENTE';
  if (mass.NON_TRAITE > 0) return 'MAITRISE_FRAGILE';
  return mass.MAITRISE >= mass.MAITRISE_FRAGILE ? 'MAITRISE' : 'MAITRISE_FRAGILE';
}

describe('1. Combinatoire exhaustive des masses (toutes les répartitions, poids 1–3, jusqu’à 4 items)', () => {
  it('aucune combinaison ne contredit les invariants', () => {
    const weights = [1, 2, 3];
    let combinations = 0;
    // Jusqu'à 4 items ; chaque item porte un des 5 profils et un poids 1–3.
    const enumerate = (count: number): Array<Array<[ItemProfile, number]>> => {
      if (count === 0) return [[]];
      const rest = enumerate(count - 1);
      const out: Array<Array<[ItemProfile, number]>> = [];
      for (const tail of rest) {
        for (const p of PROFILES) for (const w of weights) out.push([[p, w], ...tail]);
      }
      return out;
    };
    for (let n = 1; n <= 4; n += 1) {
      for (const combo of enumerate(n)) {
        combinations += 1;
        const mass: Record<ItemProfile, number> = {
          MAITRISE: 0, MAITRISE_FRAGILE: 0, LACUNE_CONSCIENTE: 0, ERREUR_CONFIANTE: 0, NON_TRAITE: 0,
        };
        for (const [p, w] of combo) mass[p] += w;
        const profile = computeNodeProfile(mass);

        // Oracle : la règle écrite, totale.
        expect(profile).toBe(expectedNodeProfile(mass));
        // Invariant 1 : une erreur confiante présente → toujours ERREUR_CONFIANTE.
        if (mass.ERREUR_CONFIANTE > 0) expect(profile).toBe('ERREUR_CONFIANTE');
        // Invariant 2 : une lacune consciente présente → jamais un « acquis ».
        if (mass.LACUNE_CONSCIENTE > 0) {
          expect(profile).not.toBe('MAITRISE');
          expect(profile).not.toBe('MAITRISE_FRAGILE');
        }
        // Invariant 3 : aucun item en difficulté → jamais un profil de difficulté.
        if (mass.ERREUR_CONFIANTE === 0 && mass.LACUNE_CONSCIENTE === 0) {
          expect(['MAITRISE', 'MAITRISE_FRAGILE', 'NON_TRAITE']).toContain(profile);
        }
        // Invariant 4 : la moindre part non traitée interdit « MAITRISE » —
        // un périmètre partiellement inconnu n'est jamais présenté acquis.
        if (mass.NON_TRAITE > 0) expect(profile).not.toBe('MAITRISE');
      }
    }
    // 15 états pondérés par item, 1 à 4 items : 15 + 15² + 15³ + 15⁴.
    expect(combinations).toBe(15 + 225 + 3375 + 50625);
  });
});

describe('2. Combinatoire de bout en bout à travers score()', () => {
  const item = (id: string, node: string, difficulty: 1 | 2 | 3): ScoringItem => ({
    id, nodeCpsId: node, difficulty, targetTimeSec: 60,
    type: 'QCM_SIMPLE', answerKey: { kind: 'QCM_SIMPLE', correct: 'A' },
  });
  type AnswerState = Readonly<{ label: string; raw: string | null; confidence: 1 | 2 | 3 | 4 | null }>;
  const STATES: readonly AnswerState[] = [
    { label: 'juste-4', raw: 'A', confidence: 4 },
    { label: 'juste-3', raw: 'A', confidence: 3 },   // frontière : confiant
    { label: 'juste-2', raw: 'A', confidence: 2 },
    { label: 'faux-4', raw: 'B', confidence: 4 },
    { label: 'faux-3', raw: 'B', confidence: 3 },    // frontière : erreur confiante
    { label: 'faux-2', raw: 'B', confidence: 2 },
    { label: 'faux-1', raw: 'B', confidence: 1 },
    { label: 'non-traité', raw: null, confidence: null },
  ];
  const stateProfile = (s: AnswerState): ItemProfile => {
    if (s.raw === null) return 'NON_TRAITE';
    const success = s.raw === 'A';
    const confident = s.confidence !== null && s.confidence >= 3;
    if (success) return confident ? 'MAITRISE' : 'MAITRISE_FRAGILE';
    return confident ? 'ERREUR_CONFIANTE' : 'LACUNE_CONSCIENTE';
  };

  it('toutes les combinaisons de 2 items (poids 1 et 3) et 3 items respectent les invariants', () => {
    const weightSets: ReadonlyArray<ReadonlyArray<1 | 2 | 3>> = [[1, 3], [3, 1], [1, 1, 1], [1, 2, 3]];
    for (const ws of weightSets) {
      const combos = ws.reduce<AnswerState[][]>((acc) => acc.flatMap((c) => STATES.map((s) => [...c, s])), [[]]);
      for (const combo of combos) {
        const items = combo.map((_, i) => item(`I${i}`, 'noeud', ws[i]));
        const answers = combo.flatMap((s, i) => (s.raw === null ? [] : [{
          itemId: `I${i}`, rawAnswer: s.raw, confidence: s.confidence, elapsedMs: 30_000,
        }]));
        const output = score({ items, answers, targetDurationMin: 3 });
        const node = output.nodes[0];
        const mass: Record<ItemProfile, number> = {
          MAITRISE: 0, MAITRISE_FRAGILE: 0, LACUNE_CONSCIENTE: 0, ERREUR_CONFIANTE: 0, NON_TRAITE: 0,
        };
        combo.forEach((s, i) => { mass[stateProfile(s)] += ws[i]; });
        expect(node.profile).toBe(expectedNodeProfile(mass));
        if (combo.some((s) => stateProfile(s) === 'ERREUR_CONFIANTE')) {
          expect(node.profile).toBe('ERREUR_CONFIANTE');
        }
        if (combo.some((s) => stateProfile(s) !== 'MAITRISE' && stateProfile(s) !== 'MAITRISE_FRAGILE' && s.raw !== null)) {
          expect(node.profile).not.toBe('MAITRISE');
          expect(node.profile).not.toBe('MAITRISE_FRAGILE');
        }
      }
    }
  });

  it('le cas du défaut : 2 items, 1 juste à 4/4 (poids 3), 1 faux à 4/4 (poids 1) → ERREUR_CONFIANTE, score 75', () => {
    const output = score({
      items: [item('OK', 'proportionnalite', 3), item('KO', 'proportionnalite', 1)],
      answers: [
        { itemId: 'OK', rawAnswer: 'A', confidence: 4, elapsedMs: 30_000 },
        { itemId: 'KO', rawAnswer: 'B', confidence: 4, elapsedMs: 30_000 },
      ],
      targetDurationMin: 2,
    });
    expect(output.nodes[0].profile).toBe('ERREUR_CONFIANTE');
    expect(output.nodes[0].nodeScore).toBe(75);
    // Et il est en tête de priorisation.
    expect(output.nodes[0].priorityRank).toBe(0);
  });
});

describe('3. Héritage domaine ← pire nœud, échelle unique', () => {
  const pack = {
    slug: 'test-pack', version: 1,
    scoring: { domains: ['D1'] },
    questionnaire: { items: [
      { id: 'A1', nodeCpsId: 'n-ec', domainId: 'D1' },
      { id: 'B1', nodeCpsId: 'n-nt', domainId: 'D1' },
    ] },
  };
  const factsBase = {
    engineVersion: 'x', globalScore: 50, coverage: 50, calibrationIndex: 50,
    flags: [], groupBand: 'CONSOLIDATION_PRIORITAIRE' as const,
  };
  const node = (id: string, profile: ItemProfile) => ({
    nodeCpsId: id, criticality: 3, nodeScore: 0, profile, itemIds: [], priorityRank: 0,
  });
  const itemResult = (id: string, nodeId: string) => ({
    itemId: id, nodeCpsId: nodeId, weight: 1, rawSuccess: 0, isSuccess: false,
    isConfident: false, profile: 'NON_TRAITE' as const, answered: false, elapsedMs: 0,
  });

  it('ERREUR_CONFIANTE l’emporte sur NON_TRAITE (l’ordre que le doublon supprimé inversait)', () => {
    const sheet = buildFactSheet(pack, {
      student: { alias: 'ELEVE_A', level: 'seconde' },
      result: {
        ...factsBase,
        items: [itemResult('A1', 'n-ec'), itemResult('B1', 'n-nt')],
        nodes: [node('n-ec', 'ERREUR_CONFIANTE'), node('n-nt', 'NON_TRAITE')],
      } as never,
    });
    expect(sheet.domains[0].profile).toBe('ERREUR_CONFIANTE');
  });

  it('tout couple de profils hérite du plus sévère selon SEVERITY_RANK', () => {
    for (const a of PROFILES) {
      for (const b of PROFILES) {
        const sheet = buildFactSheet(pack, {
          student: { alias: 'ELEVE_A', level: 'seconde' },
          result: {
            ...factsBase,
            items: [itemResult('A1', 'n-ec'), itemResult('B1', 'n-nt')],
            nodes: [node('n-ec', a), node('n-nt', b)],
          } as never,
        });
        const expected = SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
        expect(`${a}+${b}→${sheet.domains[0].profile}`).toBe(`${a}+${b}→${expected}`);
      }
    }
  });
});

describe('4. Architecture — une seule échelle de sévérité dans tout lib/bilans', () => {
  it('aucun fichier ne redéfinit un classement numérique des profils hors constants.ts', () => {
    const root = join(process.cwd(), 'lib/bilans');
    const offenders: string[] = [];
    const visit = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) { visit(full); continue; }
        if (!full.endsWith('.ts')) continue;
        if (full.endsWith('facts/constants.ts')) continue;
        const source = readFileSync(full, 'utf8');
        // Une échelle de sévérité se reconnaît à un littéral d'objet donnant
        // aux CINQ profils cinq valeurs numériques TOUTES DISTINCTES (un
        // ordre). Les compteurs de masse (tous à zéro) et les barèmes de
        // minutes (valeurs répétées) ne sont pas des ordres.
        const literalPattern = /\{[^{}]*ERREUR_CONFIANTE\s*:\s*\d[^{}]*\}/g;
        for (const literal of source.match(literalPattern) ?? []) {
          const values = PROFILES.map((profile) => {
            const m = literal.match(new RegExp(`${profile}\\s*:\\s*(\\d+)`));
            return m === null ? null : Number(m[1]);
          });
          if (values.every((v) => v !== null) && new Set(values).size === PROFILES.length) {
            offenders.push(full);
          }
        }
      }
    };
    visit(root);
    expect(offenders).toEqual([]);
  });
});
