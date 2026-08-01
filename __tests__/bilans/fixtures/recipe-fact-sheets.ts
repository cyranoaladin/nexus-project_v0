import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import type { GroupBand, NodeProfile, ResultFlag } from '@/lib/bilans/facts/types';

const DOMAIN_IDS = ['analyse', 'combinatoire', 'geometrie', 'logExp', 'probabilites'] as const;
const PROFILES: readonly NodeProfile[] = [
  'MAITRISE', 'MAITRISE_FRAGILE', 'LACUNE_CONSCIENTE', 'ERREUR_CONFIANTE', 'NON_TRAITE',
];
const BANDS: readonly GroupBand[] = [
  'CONSOLIDATION_PRIORITAIRE', 'CONSOLIDATION_STANDARD', 'RENFORCEMENT', 'APPROFONDISSEMENT',
];
const FLAGS: readonly (readonly ResultFlag[])[] = [
  [], ['COUVERTURE_INSUFFISANTE'], ['CALIBRATION_A_TRAVAILLER'], ['PASSATION_PARTIELLE'],
];

export const RECIPE_FACT_SHEETS: readonly FactSheet[] = Object.freeze(Array.from({ length: 20 }, (_, index) => {
  const globalScore = 15 + ((index * 17) % 81);
  return Object.freeze({
    engineVersion: '1.0.1',
    bankSlug: 'fixture-non-publiable-v0',
    bankVersion: 1,
    student: Object.freeze({ alias: `ELEVE_${String.fromCharCode(65 + index)}`, level: 'TERMINALE' }),
    globalScore,
    coverage: 45 + ((index * 13) % 56),
    calibrationIndex: index % 4 === 0 ? null : 30 + ((index * 11) % 71),
    domains: Object.freeze(DOMAIN_IDS.map((id, domainIndex) => Object.freeze({
      id,
      score: (globalScore + domainIndex * 9) % 101,
      profile: PROFILES[(index + domainIndex) % PROFILES.length],
    }))),
    nodes: Object.freeze([]),
    flags: Object.freeze([...FLAGS[index % FLAGS.length]]),
    groupBand: BANDS[index % BANDS.length],
  });
}));
