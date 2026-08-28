/**
 * Faits réglementaires du démonstrateur — amendement A5.
 * Doit toujours correspondre exactement au référentiel canonique 2027, sans
 * dérive ni valeur inventée.
 */
import {
  getDemoBacMap,
  getDemoRegulatoryHighlights,
  getDemoRegulatoryMilestones,
  getDemoTotalCoefficient,
} from '@/lib/demo/utica-2026/regulatory';
import { requireExamPolicy } from '@/lib/exams/catalog';
import { requireResolved } from '@/lib/exams/a-verifier';

describe('getDemoRegulatoryHighlights', () => {
  test('chaque coefficient affiché est identique à celui du référentiel officiel', () => {
    const policy = requireExamPolicy(2027);
    const highlights = getDemoRegulatoryHighlights();

    expect(highlights.provenance).toBe('REGLEMENTAIRE_CANONIQUE');
    expect(highlights.sourceLabel).toContain('2027');

    for (const h of highlights.value) {
      const epreuve = policy.epreuves.find((e) => e.id === h.id);
      expect(epreuve).toBeDefined();
      expect(h.coefficient).toBe(epreuve!.coefficient);
      expect(h.label).toBe(epreuve!.label);
    }
  });

  test('renvoie au moins le Grand Oral et la Philosophie', () => {
    const ids = getDemoRegulatoryHighlights().value.map((h) => h.id);
    expect(ids).toContain('grand-oral');
    expect(ids).toContain('philosophie');
  });
});

describe('getDemoTotalCoefficient', () => {
  test('égale le total du référentiel officiel (100)', () => {
    expect(getDemoTotalCoefficient()).toBe(requireExamPolicy(2027).totalCoefficient);
  });
});

describe('getDemoRegulatoryMilestones — "Parcours vers le Bac", §10 du gate P1A', () => {
  test('chaque jalon officiel regroupe exactement les épreuves réelles de ce timing', () => {
    const policy = requireExamPolicy(2027);
    const milestones = getDemoRegulatoryMilestones();

    expect(milestones.provenance).toBe('REGLEMENTAIRE_CANONIQUE');

    for (const m of milestones.value) {
      const expectedIds = policy.epreuves.filter((e) => e.timing === m.timing).map((e) => e.id);
      expect([...m.epreuveIds].sort()).toEqual([...expectedIds].sort());
    }
  });

  test('seuls les timings fin_premiere / fin_terminale sont utilisés (jamais selon_modalite)', () => {
    const milestones = getDemoRegulatoryMilestones();
    for (const m of milestones.value) {
      expect(['fin_premiere', 'fin_terminale']).toContain(m.timing);
    }
  });

  test("aucune date n'est présente : le référentiel n'en fournit aucune (seul le timing symbolique existe)", () => {
    const serialized = JSON.stringify(getDemoRegulatoryMilestones().value);
    // Aucune chaîne de type date ISO (YYYY-MM-DD) ne doit apparaître.
    expect(serialized).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('getDemoBacMap — Carte Bac 2027, vue générique du référentiel (CANDIDATE_SPECIFIC_BAC_MAP_DEFERRED)', () => {
  test('chaque item correspond à une épreuve réelle du référentiel (par id), avec le libellé de catalogue exact', () => {
    const policy = requireExamPolicy(2027);
    const bacMap = getDemoBacMap();
    expect(bacMap.provenance).toBe('REGLEMENTAIRE_CANONIQUE');
    expect(bacMap.sourceLabel).toContain('2027');

    const allItems = bacMap.value.flatMap((s) => s.items);
    expect(allItems.length).toBeGreaterThan(0);
    for (const item of allItems) {
      const epreuve = policy.epreuves.find((e) => e.id === item.id);
      expect(epreuve).toBeDefined();
      expect(item.label).toBe(epreuve!.label);
      expect(item.coefficient).toBe(epreuve!.coefficient);
    }
  });

  test('toutes les épreuves du référentiel apparaissent exactement une fois', () => {
    const policy = requireExamPolicy(2027);
    const bacMap = getDemoBacMap();
    const mappedIds = bacMap.value.flatMap((s) => s.items).map((i) => i.id).sort();
    expect(mappedIds).toEqual([...policy.epreuves.map((e) => e.id)].sort());
  });

  test('aucun coefficient inventé : la somme des coefficients égale exactement le total officiel', () => {
    const policy = requireExamPolicy(2027);
    const bacMap = getDemoBacMap();
    const sum = bacMap.value.flatMap((s) => s.items).reduce((acc, i) => acc + i.coefficient, 0);
    expect(sum).toBe(policy.totalCoefficient);
  });

  test('chaque épreuve appartient à la section correspondant exactement à son type réel', () => {
    const policy = requireExamPolicy(2027);
    const bacMap = getDemoBacMap();
    const sectionForType: Record<string, string> = {
      anticipe: 'PREMIERE',
      terminal: 'TERMINALE',
      ponctuel: 'PONCTUELLES_MODALITE_A',
    };
    for (const section of bacMap.value) {
      for (const item of section.items) {
        const epreuve = policy.epreuves.find((e) => e.id === item.id)!;
        expect(section.id).toBe(sectionForType[epreuve.type]);
      }
    }
  });

  test("aucune date n'apparaît dans la carte Bac (le référentiel n'en fournit aucune)", () => {
    const serialized = JSON.stringify(getDemoBacMap().value);
    expect(serialized).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  test("aucun libellé candidate-spécifique inventé (pas de nom de matière comme 'Mathématiques'/'NSI'/'SES' non présent tel quel dans le référentiel)", () => {
    const policy = requireExamPolicy(2027);
    const referentialLabels = new Set(policy.epreuves.map((e) => e.label));
    const bacMap = getDemoBacMap();
    for (const item of bacMap.value.flatMap((s) => s.items)) {
      expect(referentialLabels.has(item.label)).toBe(true);
    }
  });

  test('le sous-titre de la section ponctuelles est repris tel quel du référentiel (jamais reformulé)', () => {
    const policy = requireExamPolicy(2027);
    const candidatIndividuelRules = requireResolved(policy.candidatIndividuelRules, 'policy.candidatIndividuelRules');
    const expectedLabel = candidatIndividuelRules.ponctuellesModality.options.find((o) => o.id === 'A')!.label;

    const section = getDemoBacMap().value.find((s) => s.id === 'PONCTUELLES_MODALITE_A');
    expect(section?.subtitle).toBe(expectedLabel);
  });
});
