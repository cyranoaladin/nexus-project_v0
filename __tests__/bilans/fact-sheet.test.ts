import { buildFactSheet } from '@/lib/bilans/facts/fact-sheet';
import type { ScoringOutput } from '@/lib/bilans/facts/types';

const pack = {
  slug: 'maths-terminale-v1',
  version: 1,
  scoring: { domains: ['analyse', 'algebre'] },
  questionnaire: {
    items: [
      { id: 'q1', nodeCpsId: 'analyse.limites', domainId: 'analyse' },
      { id: 'q2', nodeCpsId: 'algebre.suites', domainId: 'algebre' },
    ],
  },
} as const;

const factsResult = {
  engineVersion: '1.0.1',
  globalScore: 61,
  coverage: 80,
  calibrationIndex: 70,
  items: [
    { itemId: 'q1', nodeCpsId: 'analyse.limites', weight: 2, rawSuccess: 0.5, isSuccess: false, isConfident: true, profile: 'ERREUR_CONFIANTE', answered: true, elapsedMs: 30_000 },
    { itemId: 'q2', nodeCpsId: 'algebre.suites', weight: 1, rawSuccess: 1, isSuccess: true, isConfident: true, profile: 'MAITRISE', answered: true, elapsedMs: 30_000 },
  ],
  nodes: [
    { nodeCpsId: 'analyse.limites', criticality: 3, nodeScore: 30, profile: 'ERREUR_CONFIANTE', itemIds: ['q1'], priorityRank: 0 },
    { nodeCpsId: 'algebre.suites', criticality: 2, nodeScore: 80, profile: 'MAITRISE', itemIds: ['q2'], priorityRank: 1 },
  ],
  flags: [],
  groupBand: 'RENFORCEMENT',
} satisfies ScoringOutput;

describe('buildFactSheet', () => {
  it('compose les domaines du pack avec les scores, profils et couverture de computeFacts', () => {
    const sheet = buildFactSheet(pack, {
      result: factsResult,
      student: { alias: 'ELEVE_A', level: 'TERMINALE' },
    });

    expect(sheet.domains).toEqual([
      { id: 'analyse', score: 50, profile: 'ERREUR_CONFIANTE' },
      { id: 'algebre', score: 100, profile: 'MAITRISE' },
    ]);
    expect(sheet.coverage).toBe(80);
    expect(sheet.globalScore).toBe(61);
    expect(sheet.domains).toHaveLength(2);
    expect(Object.isFrozen(sheet)).toBe(true);
  });

  it('rejette les domaines dupliques dans le pack', () => {
    expect(() => buildFactSheet({
      ...pack,
      scoring: { domains: ['analyse', 'analyse'] },
    }, {
      result: factsResult,
      student: { alias: 'ELEVE_A', level: 'TERMINALE' },
    })).toThrow(/domain/i);
  });

  it('rejects a non-pseudonymous student alias', () => {
    expect(() => buildFactSheet(pack, {
      result: factsResult,
      student: { alias: 'Camille', level: 'TERMINALE' },
    })).toThrow(/alias/i);
  });
});
