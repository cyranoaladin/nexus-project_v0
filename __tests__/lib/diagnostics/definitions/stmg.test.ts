import {
  getDefinition,
  listDefinitionKeys,
} from '@/lib/diagnostics/definitions';

const STMG_DEFINITIONS = [
  {
    key: 'maths-premiere-stmg-p2',
    track: 'maths-stmg',
    domains: ['suites_finance', 'fonctions', 'evolutions_indices', 'stats_2var', 'probabilites', 'algo_tableur'],
  },
  {
    key: 'sgn-premiere-stmg-p2',
    track: 'sgn-stmg',
    domains: ['organisation_information', 'individu_acteur', 'activite_processus', 'gestion_creation_valeur', 'temps_risque', 'information_collective', 'numerique_coordination', 'donnees_decision'],
  },
  {
    key: 'management-premiere-stmg-p2',
    track: 'management-stmg',
    domains: ['organisation_action_collective', 'management_strategique', 'choix_organisationnels', 'performance_parties_prenantes'],
  },
  {
    key: 'droit-eco-premiere-stmg-p2',
    track: 'droit-eco-stmg',
    domains: ['droit_sources_personnes', 'droit_contrat_responsabilite', 'eco_marche_prix', 'eco_financement_regulation'],
  },
] as const;

describe('STMG diagnostic definitions', () => {
  it('registers the four Premiere STMG definitions', () => {
    expect(listDefinitionKeys()).toEqual(expect.arrayContaining(STMG_DEFINITIONS.map((d) => d.key)));
  });

  it.each(STMG_DEFINITIONS)('loads $key with the expected domains', ({ key, track, domains }) => {
    const definition = getDefinition(key);

    expect(definition.key).toBe(key);
    expect(definition.level).toBe('premiere');
    expect(definition.stage).toBe('pallier2');
    expect(definition.track).toBe(track);
    expect(Object.keys(definition.skills)).toEqual(expect.arrayContaining([...domains]));
    expect((definition.chapters ?? []).length).toBeGreaterThanOrEqual(domains.length);
    expect(Object.keys(definition.scoringPolicy.domainWeights)).toEqual(expect.arrayContaining([...domains]));
  });
});
