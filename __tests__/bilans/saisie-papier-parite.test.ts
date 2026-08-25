/**
 * Le test qui définit le succès de la saisie papier.
 *
 * Un même jeu de réponses, passé par les deux chemins — passation en ligne
 * simulée et saisie papier — doit produire exactement le même score et le même
 * profil. Un écart signifierait qu'une saisie emprunte un second chemin de
 * calcul ; c'est précisément ce qu'il faut proscrire.
 */

import {
  assertAnswersBelongToPack,
  mergeAttemptAnswers,
  type AttemptAnswerPatch,
} from '@/lib/bilans/api/answer-merge';
import { packFeatureFlagName, resolveEnabledPack } from '@/lib/bilans/api/pack-access';
import { assertAttemptComplete } from '@/lib/bilans/api/submission-core';
import { buildPaperEntryAnswers } from '@/lib/bilans/saisie-papier/entry';
import { buildWorkerScoring } from '@/lib/bilans/worker/scoring';

import {
  CANONICAL_WORKER_ENABLED_PACK,
  CANONICAL_WORKER_PACK,
} from './fixtures/canonical-worker';

const ITEMS = CANONICAL_WORKER_PACK.questionnaire.items;
const MCO_PACK_SLUG = 'entree-terminale-maths-complementaires-v1';
const MCO_ENABLED_PACK = resolveEnabledPack(MCO_PACK_SLUG, undefined, {
  [packFeatureFlagName(MCO_PACK_SLUG)]: 'true',
});
if (MCO_ENABLED_PACK === null) throw new Error('MCO_PACK_NOT_RESOLVED');
const MCO_ITEM = MCO_ENABLED_PACK.pack.questionnaire.items[0];
const STARTED_AT = new Date('2026-08-08T09:00:00.000Z');
const SUBMITTED_AT = new Date('2026-08-08T09:18:00.000Z');

/**
 * Un jeu de réponses connu : un mélange de bonnes et de mauvaises réponses,
 * avec des certitudes variées, pour que le score ne soit ni 0 ni 100 et que
 * les quatre profils d'item soient représentés.
 */
const KNOWN_RESPONSES: readonly AttemptAnswerPatch[] = ITEMS.map((item, index) => ({
  itemId: item.id,
  optionId: index % 3 === 0
    ? item.options.find(({ isCorrect }) => isCorrect)!.id
    : item.options.find(({ isCorrect }) => !isCorrect)!.id,
  confidence: ((index % 4) + 1) as 1 | 2 | 3 | 4,
}));

/**
 * La passation en ligne enregistre les réponses par lots successifs, au fil du
 * questionnaire, via PATCH /api/bilans/attempts/[id]/answers. On rejoue cette
 * accumulation avec la fonction de fusion réellement utilisée par la route.
 */
function onlinePassationAnswers(responses: readonly AttemptAnswerPatch[]) {
  let stored: Record<string, unknown> = {};
  for (let offset = 0; offset < responses.length; offset += 5) {
    const batch = responses.slice(offset, offset + 5);
    assertAnswersBelongToPack(batch, CANONICAL_WORKER_ENABLED_PACK);
    stored = mergeAttemptAnswers(stored, batch);
  }
  assertAttemptComplete(stored, CANONICAL_WORKER_ENABLED_PACK);
  return stored;
}

function paperEntryAnswers(responses: readonly AttemptAnswerPatch[]) {
  const stored = buildPaperEntryAnswers(CANONICAL_WORKER_ENABLED_PACK, responses.map((response) => ({
    itemId: response.itemId,
    optionId: response.optionId as string,
    confidence: response.confidence,
  })));
  assertAttemptComplete(stored, CANONICAL_WORKER_ENABLED_PACK);
  return stored;
}

function scoringOf(answers: unknown) {
  return buildWorkerScoring({
    attemptId: 'attempt-parite',
    startedAt: STARTED_AT,
    submittedAt: SUBMITTED_AT,
    answers,
    pack: CANONICAL_WORKER_PACK,
  });
}

describe('Saisie papier — parité avec la passation en ligne', () => {
  it('produit exactement les mêmes réponses stockées par les deux chemins', () => {
    expect(paperEntryAnswers(KNOWN_RESPONSES)).toEqual(onlinePassationAnswers(KNOWN_RESPONSES));
  });

  it('produit le même score et le même profil par les deux chemins', () => {
    const online = scoringOf(onlinePassationAnswers(KNOWN_RESPONSES));
    const paper = scoringOf(paperEntryAnswers(KNOWN_RESPONSES));

    expect(paper.factSheet.globalScore).toBe(online.factSheet.globalScore);
    expect(paper.factSheet.domains).toEqual(online.factSheet.domains);
    expect(paper.factSheet.nodes).toEqual(online.factSheet.nodes);
    expect(paper.facts.flags).toEqual(online.facts.flags);
    expect(paper.facts.groupBand).toBe(online.facts.groupBand);
    // Égalité totale : facts, FactSheet et les trois rendus d'audience.
    expect(JSON.stringify(paper)).toBe(JSON.stringify(online));
  });

  /**
   * Les copies papier portent la certitude : le volet métacognition doit être
   * complet, à l'identique de la passation en ligne — et pas seulement le
   * score brut.
   */
  it('produit la même calibration et les mêmes profils métacognitifs', () => {
    const online = scoringOf(onlinePassationAnswers(KNOWN_RESPONSES));
    const paper = scoringOf(paperEntryAnswers(KNOWN_RESPONSES));

    expect(paper.facts.calibrationIndex).toBe(online.facts.calibrationIndex);
    expect(paper.facts.calibrationIndex).not.toBeNull();
    expect(paper.facts.items.map(({ itemId, isConfident }) => ({ itemId, isConfident })))
      .toEqual(online.facts.items.map(({ itemId, isConfident }) => ({ itemId, isConfident })));
    expect(paper.facts.items.map(({ itemId, profile }) => ({ itemId, profile })))
      .toEqual(online.facts.items.map(({ itemId, profile }) => ({ itemId, profile })));
    expect(paper.facts.nodes.map(({ nodeCpsId, profile }) => ({ nodeCpsId, profile })))
      .toEqual(online.facts.nodes.map(({ nodeCpsId, profile }) => ({ nodeCpsId, profile })));
  });

  it('ne compare pas deux résultats vides — le jeu de réponses discrimine', () => {
    const scoring = scoringOf(paperEntryAnswers(KNOWN_RESPONSES));
    expect(scoring.factSheet.globalScore).toBeGreaterThan(0);
    expect(scoring.factSheet.globalScore).toBeLessThan(100);
    // Les quatre profils d'item doivent être atteignables, donc la certitude
    // doit réellement discriminer : sans cela l'égalité de calibration
    // ci-dessus serait vraie pour de mauvaises raisons.
    const profiles = new Set(scoring.facts.items.map(({ profile }) => profile));
    expect(profiles.has('MAITRISE')).toBe(true);
    expect(profiles.has('MAITRISE_FRAGILE')).toBe(true);
    expect(profiles.has('ERREUR_CONFIANTE')).toBe(true);
    expect(profiles.has('LACUNE_CONSCIENTE')).toBe(true);
    expect(scoring.facts.calibrationIndex).toBeGreaterThan(0);
    expect(scoring.facts.calibrationIndex).toBeLessThan(100);
  });
});

describe('Saisie papier — certitude absente', () => {
  const WITHOUT_CONFIDENCE: readonly AttemptAnswerPatch[] = KNOWN_RESPONSES.map((response) => ({
    ...response,
    confidence: null,
  }));

  it('accepte une copie sans certitude cochée', () => {
    const stored = paperEntryAnswers(WITHOUT_CONFIDENCE);
    for (const item of ITEMS) {
      expect(stored[item.id]).toEqual({
        optionId: KNOWN_RESPONSES.find(({ itemId }) => itemId === item.id)!.optionId,
        confidence: null,
      });
    }
  });

  it("n'invente jamais une certitude absente", () => {
    const scoring = scoringOf(paperEntryAnswers(WITHOUT_CONFIDENCE));
    // Aucune certitude déclarée ⇒ aucun item ne peut être « confiant ».
    expect(scoring.facts.items.every(({ isConfident }) => isConfident === false)).toBe(true);
    expect(scoring.facts.items.some(({ profile }) => profile === 'ERREUR_CONFIANTE')).toBe(false);
    // La réussite, elle, reste celle des réponses lues sur la copie.
    expect(scoring.factSheet.globalScore).toBe(
      scoringOf(paperEntryAnswers(KNOWN_RESPONSES)).factSheet.globalScore,
    );
  });

  it('accepte une certitude partielle sans la propager aux autres items', () => {
    const partial = KNOWN_RESPONSES.map((response, index) => ({
      ...response,
      confidence: index === 0 ? (4 as const) : null,
    }));
    const stored = paperEntryAnswers(partial);
    expect(stored[ITEMS[0].id]).toEqual({ optionId: partial[0].optionId, confidence: 4 });
    for (const item of ITEMS.slice(1)) {
      expect((stored[item.id] as { confidence: unknown }).confidence).toBeNull();
    }
  });
});

describe('Saisie papier MCO — certitude absente sur la copie', () => {
  it('accepte et conserve une réponse cochée sans certitude', () => {
    const stored = buildPaperEntryAnswers(MCO_ENABLED_PACK, [{
      itemId: MCO_ITEM.id,
      optionId: MCO_ITEM.options[0].id,
      confidence: null,
    }]);

    expect(stored[MCO_ITEM.id]).toEqual({
      optionId: MCO_ITEM.options[0].id,
      confidence: null,
    });
  });

  it('autorise toujours une question déclarée sans réponse', () => {
    expect(() => buildPaperEntryAnswers(MCO_ENABLED_PACK, [{
      itemId: MCO_ITEM.id,
      optionId: null,
      confidence: null,
    }])).not.toThrow();
  });

  it('préserve la certitude nullable des autres packs papier', () => {
    expect(() => buildPaperEntryAnswers(CANONICAL_WORKER_ENABLED_PACK, [{
      itemId: ITEMS[0].id,
      optionId: ITEMS[0].options[0].id,
      confidence: null,
    }])).not.toThrow();
  });
});

describe('Saisie papier — un item nommé « __proto__ »', () => {
  /**
   * Une affectation `merged[itemId] = …` détournerait un item nommé
   * `__proto__` vers le prototype : la lecture semblerait réussir, la
   * complétude passerait, mais `JSON.stringify` ne sérialise pas un prototype
   * — la réponse disparaîtrait à l'enregistrement et le worker échouerait plus
   * tard. Accepter puis échouer en différé est le pire des deux mondes.
   */
  it('enregistre la réponse comme propriété propre, et non sur le prototype', () => {
    const merged = mergeAttemptAnswers({}, [
      { itemId: '__proto__', optionId: 'A', confidence: 3 },
      { itemId: 'constructor', optionId: 'B', confidence: null },
    ]);

    expect(Object.prototype.hasOwnProperty.call(merged, '__proto__')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(merged, 'constructor')).toBe(true);
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);

    // Ce qui compte vraiment : la réponse survit à la sérialisation, donc à
    // l'enregistrement. Les assertions passent par les descripteurs de
    // propriété — un littéral `{ __proto__: … }` retomberait dans le piège
    // même que ce test surveille.
    const roundTripped = JSON.parse(JSON.stringify(merged)) as object;
    expect(Object.getOwnPropertyDescriptor(roundTripped, '__proto__')?.value)
      .toEqual({ optionId: 'A', confidence: 3 });
    expect(Object.getOwnPropertyDescriptor(roundTripped, 'constructor')?.value)
      .toEqual({ optionId: 'B', confidence: null });
  });
});

describe('Saisie papier — refus des réponses hors pack', () => {
  it('rejette un item inconnu du pack', () => {
    expect(() => buildPaperEntryAnswers(CANONICAL_WORKER_ENABLED_PACK, [
      { itemId: 'ITEM-INEXISTANT', optionId: 'A', confidence: null },
    ])).toThrow();
  });

  it('rejette une option inconnue de l’item', () => {
    expect(() => buildPaperEntryAnswers(CANONICAL_WORKER_ENABLED_PACK, [
      { itemId: ITEMS[0].id, optionId: 'Z', confidence: null },
    ])).toThrow();
  });

  it('rejette une copie incomplète au moment de la soumission', () => {
    const stored = buildPaperEntryAnswers(
      CANONICAL_WORKER_ENABLED_PACK,
      KNOWN_RESPONSES.slice(0, 4).map((response) => ({
        itemId: response.itemId,
        optionId: response.optionId as string,
        confidence: response.confidence,
      })),
    );
    expect(() => assertAttemptComplete(stored, CANONICAL_WORKER_ENABLED_PACK)).toThrow();
  });
});

describe('Saisie papier — « Sans réponse » scorable de bout en bout', () => {
  /**
   * Le défaut du 13/08/2026 : la saisie acceptait « Sans réponse »
   * (optionId null) — grille, API, assertAttemptComplete — mais le worker de
   * scoring la rejetait (A86_ANSWER_MISSING, masqué en A86_WORKER_FAILED). Un
   * élève avec une copie partielle restait sans bilan. Parité rétablie : ce
   * que la saisie accepte, le moteur le score.
   */
  const withBlanks: readonly AttemptAnswerPatch[] = ITEMS.map((item, index) => (
    index < 2
      ? { itemId: item.id, optionId: null as unknown as string, confidence: null }
      : {
          itemId: item.id,
          optionId: item.options.find(({ isCorrect }) => isCorrect)!.id,
          confidence: 3 as const,
        }
  ));

  it('la saisie accepte la copie avec « Sans réponse » (assertAttemptComplete passe)', () => {
    const stored = buildPaperEntryAnswers(CANONICAL_WORKER_ENABLED_PACK, withBlanks.map((r) => ({
      itemId: r.itemId, optionId: r.optionId, confidence: r.confidence,
    })));
    expect(() => assertAttemptComplete(stored, CANONICAL_WORKER_ENABLED_PACK)).not.toThrow();
    expect(stored[ITEMS[0].id]).toEqual({ optionId: null, confidence: null });
  });

  it('le worker score la même copie : les items sans réponse deviennent NON_TRAITE', () => {
    const stored = buildPaperEntryAnswers(CANONICAL_WORKER_ENABLED_PACK, withBlanks.map((r) => ({
      itemId: r.itemId, optionId: r.optionId, confidence: r.confidence,
    })));
    // Ne jette plus A86_ANSWER_MISSING.
    const scoring = scoringOf(stored);
    const nonTraites = scoring.facts.items.filter((i) => i.profile === 'NON_TRAITE');
    expect(nonTraites).toHaveLength(2);
    // La couverture reflète les items réellement traités.
    expect(scoring.factSheet.coverage).toBeCloseTo(100 * (ITEMS.length - 2) / ITEMS.length, 1);
  });

  it('une non-réponse assortie d’une certitude est refusée (donnée incohérente)', () => {
    const incoherent = { [ITEMS[0].id]: { optionId: null, confidence: 3 } } as unknown;
    const full: Record<string, unknown> = {};
    ITEMS.forEach((item, index) => {
      full[item.id] = index === 0
        ? { optionId: null, confidence: 3 }
        : { optionId: item.options.find(({ isCorrect }) => isCorrect)!.id, confidence: 3 };
    });
    expect(() => scoringOf(full)).toThrow('A86_ANSWER_OPTION_INVALID');
    void incoherent;
  });
});
