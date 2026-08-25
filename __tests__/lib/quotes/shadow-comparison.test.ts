import {
  buildAggregateDivergenceReport,
  computeSituationChecksum,
  runShadowComparison,
  situationToPublicInput,
  type ShadowComparisonRecord,
} from '@/lib/quotes/shadow-comparison';
import { resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';
import type { SituationInput } from '@/lib/quotes/schemas';
import type { BuildRecommendationInput } from '@/lib/quotes/recommendation';

const situation: SituationInput = {
  level: 'terminale',
  examSession: 2027,
  specialites: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'],
};

function legacyInput(overrides: Partial<BuildRecommendationInput> = {}): BuildRecommendationInput {
  return {
    situation,
    diagnosticDomainScores: null,
    budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
    ...overrides,
  };
}

afterEach(() => resetCatalogueCacheForTests());

describe('computeSituationChecksum — jamais de PII', () => {
  test('déterministe pour une même situation', () => {
    expect(computeSituationChecksum(situation)).toBe(computeSituationChecksum(situation));
  });

  test('ne contient aucun champ nominatif (par construction — SituationInput lui-même n\'en a pas)', () => {
    const checksum = computeSituationChecksum(situation);
    expect(checksum).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex — jamais un JSON en clair
  });
});

describe('situationToPublicInput — jamais de modalité inférée', () => {
  test('modalite reste null (SituationInput ne porte aucun concept de modalité)', () => {
    const input = situationToPublicInput(situation);
    expect(input.modalite).toBeNull();
  });
});

describe('runShadowComparison — ne lève jamais, jamais de fuite vers la réponse legacy', () => {
  test('la comparaison retourne toujours un enregistrement structuré, jamais une exception propagée', () => {
    const record = runShadowComparison(situation, legacyInput());
    expect(record.situationChecksum).toBeTruthy();
    expect(record.divergenceCategory).toBeTruthy();
  });

  test('modalité absente -> INSUFFICIENT_INPUT (fail-closed, jamais deviné)', () => {
    const record = runShadowComparison(situation, legacyInput());
    expect(record.divergenceCategory).toBe('INSUFFICIENT_INPUT');
  });

  test('le résumé new ne contient jamais de coût interne', () => {
    const record = runShadowComparison(situation, legacyInput());
    const json = JSON.stringify(record).toLowerCase();
    for (const forbidden of ['teachercost', 'costprice', 'grossmargin', 'coutenseignant']) {
      expect(json).not.toContain(forbidden);
    }
  });
});

describe('buildAggregateDivergenceReport — mission §7', () => {
  function record(category: ShadowComparisonRecord['divergenceCategory']): ShadowComparisonRecord {
    return {
      situationChecksum: 'x',
      divergenceCategory: category,
      legacySummary: { subjects: [], priceAnnualTnd: null, depositTnd: null, installmentTnd: null, status: 'x', warningsCount: 0 },
      newSummary: { subjects: [], priceAnnualTnd: null, depositTnd: null, installmentTnd: null, status: 'x', warningsCount: 0 },
      detail: '',
    };
  }

  test('agrège correctement le nombre total et la proportion identique', () => {
    const report = buildAggregateDivergenceReport([record('IDENTICAL'), record('IDENTICAL'), record('PRICING_DIFFERENCE'), record('INSUFFICIENT_INPUT')]);
    expect(report.totalSimulations).toBe(4);
    expect(report.identicalPct).toBe(50);
    expect(report.pricingDifferences).toBe(1);
  });

  test('un rapport vide ne divise jamais par zéro', () => {
    const report = buildAggregateDivergenceReport([]);
    expect(report.totalSimulations).toBe(0);
    expect(report.identicalPct).toBe(0);
  });
});
