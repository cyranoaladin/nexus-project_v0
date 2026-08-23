import { loadBilanPack } from '@/lib/bilans/catalog/load-pack';
import { groupDomainsForDisplay } from '@/lib/bilans/render/subject-display';

/**
 * Les huit domaines du pack Mathématiques complémentaires doivent se ranger
 * dans les groupes prévus par la politique d'affichage — aucun ne doit
 * tomber dans « Autres repères… », et les taux d'évolution relèvent des
 * automatismes quantitatifs, pas de l'analyse.
 */
describe('affichage des domaines — Mathématiques complémentaires', () => {
  const pack = loadBilanPack('data/bilans/banks/entree-terminale-maths-complementaires-v1.json');
  const domains = pack.scoring.domains.map((id) => ({ id }));

  test('chaque domaine du pack rejoint son groupe, sans reliquat', () => {
    const groups = groupDomainsForDisplay('MATHS_COMPLEMENTAIRES', domains);
    const byLabel = Object.fromEntries(groups.map((group) => [group.label, group.domains.map(({ id }) => id)]));
    expect(byLabel).toEqual({
      'Analyse et modèles': ['suites-evolutions', 'derivation', 'exponentielle', 'logarithme-reperage', 'second-degre'],
      'Probabilités et décision': ['probabilites-conditionnelles', 'variables-aleatoires'],
      'Automatismes quantitatifs': ['taux-evolution'],
    });
    expect(groups.map(({ label }) => label)).not.toContain('Autres repères de mathématiques complémentaires');
  });
});
