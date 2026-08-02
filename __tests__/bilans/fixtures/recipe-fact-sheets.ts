import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import type { GroupBand, NodeProfile, ResultFlag } from '@/lib/bilans/facts/types';

const DOMAIN_IDS = ['analyse', 'combinatoire', 'geometrie', 'logExp', 'probabilites'] as const;
const ENTRY_DOMAIN_IDS = ['second-degre', 'derivation', 'exponentielle', 'suites', 'produit-scalaire'] as const;
const PREMIERE_ENTRY_DOMAIN_IDS = [
  'calcul-litteral', 'inequations', 'fonctions', 'fonctions-reference', 'vecteurs',
  'droites', 'pourcentages', 'probabilites', 'calcul-numerique',
] as const;
const PROFILES: readonly NodeProfile[] = [
  'MAITRISE', 'MAITRISE_FRAGILE', 'LACUNE_CONSCIENTE', 'ERREUR_CONFIANTE', 'NON_TRAITE',
];
const BANDS: readonly GroupBand[] = [
  'CONSOLIDATION_PRIORITAIRE', 'CONSOLIDATION_STANDARD', 'RENFORCEMENT', 'APPROFONDISSEMENT',
];
const FLAGS: readonly (readonly ResultFlag[])[] = [
  [], ['COUVERTURE_INSUFFISANTE'], ['CALIBRATION_A_TRAVAILLER'], ['PASSATION_PARTIELLE'],
];

function buildRecipeFactSheets(
  domainIds: readonly string[],
  level: 'PREMIERE' | 'TERMINALE' = 'TERMINALE',
): readonly FactSheet[] {
  return Object.freeze(Array.from({ length: 20 }, (_, index) => {
  const globalScore = 15 + ((index * 17) % 81);
  return Object.freeze({
    engineVersion: '1.0.1',
    bankSlug: 'fixture-non-publiable-v0',
    bankVersion: 1,
    student: Object.freeze({ alias: `ELEVE_${String.fromCharCode(65 + index)}`, level }),
    globalScore,
    coverage: 45 + ((index * 13) % 56),
    calibrationIndex: index % 4 === 0 ? null : 30 + ((index * 11) % 71),
    domains: Object.freeze(domainIds.map((id, domainIndex) => Object.freeze({
      id,
      score: (globalScore + domainIndex * 9) % 101,
      profile: PROFILES[(index + domainIndex) % PROFILES.length],
    }))),
    nodes: Object.freeze([]),
    flags: Object.freeze([...FLAGS[index % FLAGS.length]]),
    groupBand: BANDS[index % BANDS.length],
  });
  }));
}

export const RECIPE_FACT_SHEETS = buildRecipeFactSheets(DOMAIN_IDS);
export const ENTRY_RECIPE_FACT_SHEETS = buildRecipeFactSheets(ENTRY_DOMAIN_IDS);
export const PREMIERE_ENTRY_RECIPE_FACT_SHEETS = buildRecipeFactSheets(PREMIERE_ENTRY_DOMAIN_IDS, 'PREMIERE');
