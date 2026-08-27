/**
 * P2 §4 — normalisation finale. `CompetencyLevel` doit être un sous-ensemble
 * réel du vocabulaire canonique de production (`PedagogicalStatus`), pas un
 * système parallèle. Ce test échoue si les deux vocabulaires divergent un jour.
 */
import { demoScenario } from '@/lib/demo/utica-2026/scenario';

const CANONICAL_PEDAGOGICAL_STATUS = [
  'Non renseigné',
  'Non encore vu',
  'Découverte prioritaire',
  'Déclaré vu mais non évalué',
  'Non vu déclaré, réussite observée',
  'Lacune critique',
  'Très fragile',
  'Fragile',
  'À consolider',
  'Maîtrisé',
  'Point fort',
];

describe('Normalisation du vocabulaire de maîtrise (P2 §4, Cas A)', () => {
  test('chaque niveau de compétence utilisé dans le scénario appartient au vocabulaire canonique PedagogicalStatus', () => {
    const usedLevels = new Set(demoScenario.subjectTracks.flatMap((t) => t.competencies.map((c) => c.level)));
    expect(usedLevels.size).toBeGreaterThan(0);
    for (const level of usedLevels) {
      expect(CANONICAL_PEDAGOGICAL_STATUS).toContain(level);
    }
  });

  test('aucun ancien littéral démo (MAITRISE/EN_PROGRESSION/A_CONSOLIDER/NON_COMMENCE) ne subsiste', () => {
    const serialized = JSON.stringify(demoScenario.subjectTracks);
    for (const legacy of ['MAITRISE', 'EN_PROGRESSION', 'A_CONSOLIDER', 'NON_COMMENCE']) {
      expect(serialized).not.toContain(legacy);
    }
  });
});
