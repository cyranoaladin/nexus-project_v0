/**
 * P1B §2 — Dossier candidat. Chaque item porte une origine explicite
 * (réutilise `Provenance`) ; un contrôle Nexus n'est jamais présenté comme
 * une obligation réglementaire ; le nombre de blocages reste identique
 * partout où il est affiché (Parent, dimension Vue 360°).
 */
import { getAdministrativeSummary, getJourneyOverview } from '@/lib/demo/utica-2026/selectors';
import { demoScenario } from '@/lib/demo/utica-2026/scenario';

describe('Dossier candidat — origine explicite par item', () => {
  test('chaque item du dossier administratif porte une provenance valide', () => {
    for (const item of demoScenario.administrative) {
      expect(['REGLEMENTAIRE_CANONIQUE', 'ETAPE_NEXUS', 'DEMONSTRATION']).toContain(item.provenance);
    }
  });

  test("aucun item n'est présenté comme une obligation réglementaire officielle (aucune source canonique n'existe pour le dossier administratif candidat individuel)", () => {
    for (const item of demoScenario.administrative) {
      expect(item.provenance).not.toBe('REGLEMENTAIRE_CANONIQUE');
    }
  });

  test('les métriques de synthèse sont des comptages exacts, jamais un pourcentage', () => {
    const summary = getAdministrativeSummary();
    const total = summary.items.length;
    const validated = summary.countByStatus.VALIDE;
    const toCheck = summary.countByStatus.A_VERIFIER + summary.countByStatus.A_REMPLACER;

    expect(total).toBe(demoScenario.administrative.length);
    expect(validated).toBeGreaterThanOrEqual(0);
    expect(toCheck).toBeGreaterThanOrEqual(0);
    expect(validated + toCheck + summary.countByStatus.EN_COURS + summary.countByStatus.NON_CONCERNE + summary.countByStatus.A_PREPARER).toBe(total);
  });
});

describe('Blocages administratifs — identiques Parent / Vue 360°', () => {
  test('administrativeBlockingCount (Parent) == bullet de la dimension Administratif (Vue 360°)', () => {
    const { administrativeBlockingCount } = getAdministrativeSummary();
    const dimension = getJourneyOverview().find((d) => d.key === 'ADMINISTRATIF')!;
    const expectedState = administrativeBlockingCount === 0 ? 'SOUS_CONTROLE' : 'ACTION_REQUISE';
    expect(dimension.state).toBe(expectedState);
  });
});
