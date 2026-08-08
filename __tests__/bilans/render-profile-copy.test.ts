import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import {
  PROFILE_FAMILY_LABELS,
  buildProfiledNarrative,
} from '@/lib/bilans/render/profile-copy';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';

const factSheet: FactSheet = Object.freeze({
  engineVersion: '1.0.1',
  bankSlug: 'fixture-a90-v1',
  bankVersion: 1,
  student: Object.freeze({ alias: 'ELEVE_A', level: 'TERMINALE' }),
  globalScore: 48,
  coverage: 92,
  calibrationIndex: 61,
  domains: Object.freeze([
    Object.freeze({ id: 'non-traite', score: 0, profile: 'NON_TRAITE' as const }),
    Object.freeze({ id: 'solide', score: 91, profile: 'MAITRISE' as const }),
    Object.freeze({ id: 'fragile', score: 58, profile: 'MAITRISE_FRAGILE' as const }),
    Object.freeze({ id: 'lacune', score: 31, profile: 'LACUNE_CONSCIENTE' as const }),
    Object.freeze({ id: 'erreur-b', score: 18, profile: 'ERREUR_CONFIANTE' as const }),
    Object.freeze({ id: 'erreur-a', score: 18, profile: 'ERREUR_CONFIANTE' as const }),
  ]),
  nodes: Object.freeze([]),
  flags: Object.freeze([]),
  groupBand: 'CONSOLIDATION_STANDARD',
});

const identity: RenderIdentity = Object.freeze({
  displayName: 'ELEVE_DEMONSTRATION',
  level: 'TERMINALE',
  subject: 'MATHS',
  date: '2026-08-03',
  stageLabel: 'Stage de pré-rentrée',
});

describe('A90.1 deterministic profile copy', () => {
  it('orders priorities by profile, then ascending score, then canonical domain order', () => {
    const narrative = buildProfiledNarrative(factSheet, identity, 'PARENTS');
    const nexusNarrative = buildProfiledNarrative(factSheet, identity, 'NEXUS');

    expect(narrative.priorities.map(({ domainId }) => domainId)).toEqual([
      'erreur-b',
      'erreur-a',
      'lacune',
      'fragile',
      'non-traite',
    ]);
    expect(narrative.forces.map(({ domainId }) => domainId)).toEqual(['solide']);
    expect(nexusNarrative.priorities[0]).toMatchObject({ profile: 'ERREUR_CONFIANTE' });
  });

  it('uses distinct versioned copy for every profile and audience', () => {
    for (const audience of ['ELEVE', 'PARENTS', 'NEXUS'] as const) {
      const narrative = buildProfiledNarrative(factSheet, identity, audience);
      const texts = [...narrative.forces, ...narrative.priorities].map(({ text }) => text);
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it('never exposes technical profile labels to ELEVE or PARENTS', () => {
    for (const audience of ['ELEVE', 'PARENTS'] as const) {
      const serialized = JSON.stringify(buildProfiledNarrative(factSheet, identity, audience));
      for (const technical of Object.keys(PROFILE_FAMILY_LABELS)) {
        expect(serialized).not.toContain(technical);
      }
      for (const label of Object.values(PROFILE_FAMILY_LABELS)) {
        expect(serialized).toContain(label);
      }
    }
  });
});
