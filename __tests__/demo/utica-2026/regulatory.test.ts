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

describe('getDemoBacMap — Carte Bac 2027 candidate-spécifique (P1C §0, résolue via genererCarteExamen)', () => {
  test('chaque item correspond à une épreuve réelle du référentiel (par id)', () => {
    const policy = requireExamPolicy(2027);
    const bacMap = getDemoBacMap();
    expect(bacMap.provenance).toBe('REGLEMENTAIRE_CANONIQUE');
    expect(bacMap.sourceLabel).toContain('genererCarteExamen');

    const allItems = bacMap.value.flatMap((s) => s.items);
    expect(allItems.length).toBeGreaterThan(0);
    for (const item of allItems) {
      const epreuve = policy.epreuves.find((e) => e.id === item.id);
      expect(epreuve).toBeDefined();
    }
  });

  test('la carte est entièrement résolue pour ce profil : aucun coefficient "À_VERIFIER"', () => {
    const bacMap = getDemoBacMap();
    for (const item of bacMap.value.flatMap((s) => s.items)) {
      expect(typeof item.coefficient).toBe('number');
    }
  });

  test('les deux spécialités conservées portent le vrai nom de matière du candidat (pas "Enseignement de spécialité 1/2")', () => {
    const bacMap = getDemoBacMap();
    const terminale = bacMap.value.find((s) => s.id === 'TERMINALE')!;
    const eds1 = terminale.items.find((i) => i.id === 'eds1');
    const eds2 = terminale.items.find((i) => i.id === 'eds2');
    expect([eds1?.label, eds2?.label].sort()).toEqual(['Mathématiques', 'NSI'].sort());
  });

  test('la spécialité abandonnée porte le vrai nom de matière (SES)', () => {
    const bacMap = getDemoBacMap();
    const ponctuelles = bacMap.value.find((s) => s.id === 'PONCTUELLES_MODALITE_A')!;
    const abandonnee = ponctuelles.items.find((i) => i.id === 'specialite-abandonnee');
    expect(abandonnee?.label).toBe('SES');
  });

  test('la ligne NSI porte la note de dispense de partie pratique renvoyée par le moteur (jamais reformulée)', () => {
    const bacMap = getDemoBacMap();
    const nsi = bacMap.value.flatMap((s) => s.items).find((i) => i.label === 'NSI');
    expect(nsi?.notes.some((n) => n.toLowerCase().includes('dispensé'))).toBe(true);
  });

  test("les compétences suivies par le scénario pédagogique (Mathématiques, NSI, Philosophie) sont marquées trackedByNexus", () => {
    const bacMap = getDemoBacMap();
    const allItems = bacMap.value.flatMap((s) => s.items);
    for (const label of ['Mathématiques', 'NSI', 'Philosophie']) {
      const item = allItems.find((i) => i.label === label);
      expect(item?.trackedByNexus).toBe(true);
    }
    const grandOral = allItems.find((i) => i.label === 'Grand Oral');
    expect(grandOral?.trackedByNexus).toBe(false);
  });

  test('aucun coefficient inventé : la somme des coefficients numériques ne dépasse jamais le total officiel', () => {
    const policy = requireExamPolicy(2027);
    const bacMap = getDemoBacMap();
    const sum = bacMap.value
      .flatMap((s) => s.items)
      .reduce((acc, i) => acc + (typeof i.coefficient === 'number' ? i.coefficient : 0), 0);
    expect(sum).toBeLessThanOrEqual(policy.totalCoefficient);
  });

  test('chaque épreuve appartient à la section correspondant exactement à son timing réel', () => {
    const policy = requireExamPolicy(2027);
    const bacMap = getDemoBacMap();
    const sectionForTiming: Record<string, string> = {
      fin_premiere: 'PREMIERE',
      fin_terminale: 'TERMINALE',
      selon_modalite: 'PONCTUELLES_MODALITE_A',
    };
    for (const section of bacMap.value) {
      for (const item of section.items) {
        const epreuve = policy.epreuves.find((e) => e.id === item.id)!;
        expect(section.id).toBe(sectionForTiming[epreuve.timing]);
      }
    }
  });

  test("aucune date n'apparaît dans la carte Bac (le référentiel n'en fournit aucune)", () => {
    const serialized = JSON.stringify(getDemoBacMap().value);
    expect(serialized).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  test('le sous-titre de la section ponctuelles est repris tel quel du référentiel (jamais reformulé)', () => {
    const policy = requireExamPolicy(2027);
    const rules = policy.candidatIndividuelRules;
    if (typeof rules === 'string') throw new Error('candidatIndividuelRules À_VERIFIER — test à revoir');
    const expectedLabel = rules.ponctuellesModality.options.find((o) => o.id === 'A')!.label;

    const section = getDemoBacMap().value.find((s) => s.id === 'PONCTUELLES_MODALITE_A');
    expect(section?.subtitle).toBe(expectedLabel);
  });
});
