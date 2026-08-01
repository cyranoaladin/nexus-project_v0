import { buildFactSheet } from '@/lib/bilans/facts/fact-sheet';
import type { ScoringOutput } from '@/lib/bilans/facts/types';
import type { ScoringV2Result } from '@/lib/diagnostics/types';

const scoringV2 = {
  coverageIndex: 75,
  domainScores: [
    { domain: 'analyse', score: 42 },
    { domain: 'algebre', score: 78 },
  ],
} as ScoringV2Result;

const factsResult = {
  engineVersion: '1.0.1',
  globalScore: 61,
  coverage: 80,
  calibrationIndex: 70,
  items: [],
  nodes: [
    { nodeCpsId: 'analyse.limites', criticality: 3, nodeScore: 30, profile: 'ERREUR_CONFIANTE', itemIds: ['q1'], priorityRank: 0 },
    { nodeCpsId: 'algebre.suites', criticality: 2, nodeScore: 80, profile: 'MAITRISE', itemIds: ['q2'], priorityRank: 1 },
  ],
  flags: [],
  groupBand: 'RENFORCEMENT',
} satisfies ScoringOutput;

describe('buildFactSheet', () => {
  it('composes V2 domains and coverage with computeFacts profiles', () => {
    const sheet = buildFactSheet(scoringV2, {
      result: factsResult,
      bank: { slug: 'maths-terminale-v1', version: 1, domainIds: ['analyse', 'algebre'] },
      student: { alias: 'ELEVE_A', level: 'TERMINALE' },
      nodeDomains: {
        'analyse.limites': 'analyse',
        'algebre.suites': 'algebre',
      },
    });

    expect(sheet.domains).toEqual([
      { id: 'analyse', score: 42, profile: 'ERREUR_CONFIANTE' },
      { id: 'algebre', score: 78, profile: 'MAITRISE' },
    ]);
    expect(sheet.coverage).toBe(75);
    expect(sheet.globalScore).toBe(61);
    expect(sheet.domains).toHaveLength(2);
    expect(Object.isFrozen(sheet)).toBe(true);
  });

  it('fails closed when the pack and V2 domain sets diverge', () => {
    expect(() => buildFactSheet(scoringV2, {
      result: factsResult,
      bank: { slug: 'maths-terminale-v1', version: 1, domainIds: ['analyse'] },
      student: { alias: 'ELEVE_A', level: 'TERMINALE' },
      nodeDomains: {},
    })).toThrow(/domain/i);
  });

  it('rejects a non-pseudonymous student alias', () => {
    expect(() => buildFactSheet(scoringV2, {
      result: factsResult,
      bank: { slug: 'maths-terminale-v1', version: 1, domainIds: ['analyse', 'algebre'] },
      student: { alias: 'Camille', level: 'TERMINALE' },
      nodeDomains: {},
    })).toThrow(/alias/i);
  });
});
