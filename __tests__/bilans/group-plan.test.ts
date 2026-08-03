import type { CpsCatalog } from '@/lib/bilans/catalog/bank-validation';
import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import type { GroupBand, NodeProfile } from '@/lib/bilans/facts/types';
import { aggregateGroupProfile, buildGroupPlan, type GroupMember } from '@/lib/bilans/group-plan/plan';

const PROFILES: readonly NodeProfile[] = ['MAITRISE', 'MAITRISE_FRAGILE', 'LACUNE_CONSCIENTE', 'ERREUR_CONFIANTE', 'NON_TRAITE'];
const BANDS: readonly GroupBand[] = ['CONSOLIDATION_PRIORITAIRE', 'CONSOLIDATION_STANDARD', 'RENFORCEMENT', 'APPROFONDISSEMENT'];
const catalog: CpsCatalog = {
  schemaVersion: 'nexus-cps-catalog/v1', slug: 'fixture-group-cps-v1', version: 1,
  nodes: Array.from({ length: 9 }, (_, index) => ({
    id: `2de.maths.fixture.node-${index + 1}`, label: `Nœud ${index + 1}`,
    sourceLevel: 'SECONDE', targetLevel: 'PREMIERE', sequenceOrder: index + 1,
    pedagogicalRationale: 'Prérequis synthétique pour le test du plan de groupe.',
  })),
};

function factSheet(alias: string, profiles: readonly NodeProfile[], band: GroupBand): FactSheet {
  return Object.freeze({
    engineVersion: '1.0.1', bankSlug: 'entree-premiere-maths-v1', bankVersion: 1,
    student: Object.freeze({ alias, level: 'PREMIERE' }), globalScore: 50, coverage: 100,
    calibrationIndex: 70, domains: Object.freeze([]), flags: Object.freeze([]), groupBand: band,
    nodes: Object.freeze(catalog.nodes.map((node, index) => Object.freeze({
      nodeCpsId: node.id, criticality: 1, nodeScore: 50, profile: profiles[index],
      itemIds: Object.freeze([`ITEM-${index + 1}`]), priorityRank: index,
    }))),
  });
}

function members(configuration: number, size = 3 + (configuration % 3)): readonly GroupMember[] {
  return Object.freeze(Array.from({ length: size }, (_, studentIndex) => Object.freeze({
    displayName: `Élève ${studentIndex + 1}`,
    factSheet: factSheet(`ELEVE_${String.fromCharCode(65 + studentIndex)}`, catalog.nodes.map((_node, nodeIndex) => PROFILES[(configuration + studentIndex + nodeIndex) % PROFILES.length]), BANDS[studentIndex % BANDS.length]),
  })));
}

describe('A108 group profile aggregation', () => {
  it('creates DIVISE only when acquired and difficulty coexist below two thirds', () => {
    expect(aggregateGroupProfile(['MAITRISE', 'MAITRISE', 'MAITRISE_FRAGILE', 'ERREUR_CONFIANTE', 'LACUNE_CONSCIENTE'])).toBe('DIVISE');
  });
  it('applies majority difficulty first and treats mostly non-treated as a conscious gap', () => {
    expect(aggregateGroupProfile(['MAITRISE', 'MAITRISE', 'ERREUR_CONFIANTE', 'LACUNE_CONSCIENTE'])).toBe('ERREUR_CONFIANTE');
    expect(aggregateGroupProfile(['NON_TRAITE', 'NON_TRAITE', 'MAITRISE'])).toBe('LACUNE_CONSCIENTE');
  });
});

describe('A109-A114 deterministic allocation and global cuts', () => {
  it('preserves 600 node-minutes over twenty configurations and explicitly signals infeasible cuts', () => {
    let arbitrationCount = 0;
    for (let index = 0; index < 20; index += 1) {
      const inputs = members(index);
      const plan = buildGroupPlan(catalog, inputs);
      expect(plan.nodes.reduce((sum, node) => sum + node.minutes, 0)).toBe(600);
      expect(plan.sessions).toHaveLength(5);
      expect(new Map(plan.sessions.flatMap(({ nodes }) => nodes).map(({ nodeCpsId, minutes }) => [nodeCpsId, minutes]))).toEqual(new Map(plan.nodes.map(({ nodeCpsId, minutes }) => [nodeCpsId, minutes])));
      expect(plan.sessions.flatMap(({ nodes }) => nodes.map(({ sequenceOrder }) => sequenceOrder))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(plan.sessions.every(({ nodes }) => nodes.every(({ minutes }) => minutes >= 15))).toBe(true);
      const outside = plan.sessions.some(({ contentMinutes }) => contentMinutes < 105 || contentMinutes > 135);
      expect(plan.schedulingStatus === 'TEACHER_ARBITRATION_REQUIRED').toBe(outside);
      if (outside) { arbitrationCount += 1; expect(plan.schedulingWarnings.length).toBeGreaterThan(0); }
      expect(buildGroupPlan(catalog, inputs)).toEqual(plan);
    }
    expect(arbitrationCount).toBe(20);
  });

  it('handles the A113 counterexample without changing the 600-minute total', () => {
    const target = ['MAITRISE_FRAGILE', 'ERREUR_CONFIANTE', 'ERREUR_CONFIANTE', 'ERREUR_CONFIANTE', 'MAITRISE_FRAGILE', 'DIVISE', 'DIVISE', 'ERREUR_CONFIANTE', 'MAITRISE'] as const;
    const inputs = members(0, 5).map((member, studentIndex) => ({
      ...member,
      factSheet: factSheet(member.factSheet.student.alias, target.map((profile) => profile === 'DIVISE' ? (studentIndex < 3 ? 'MAITRISE' : 'ERREUR_CONFIANTE') : profile), member.factSheet.groupBand),
    }));
    const plan = buildGroupPlan(catalog, inputs);
    expect(plan.nodes.reduce((sum, node) => sum + node.minutes, 0)).toBe(600);
    expect(plan.sessions).toHaveLength(5);
    expect(plan.schedulingStatus).toBe('TEACHER_ARBITRATION_REQUIRED');
  });

  it.each(['MAITRISE', 'ERREUR_CONFIANTE'] as const)('keeps nine identical profiles deterministic: %s', (profile) => {
    const inputs = Array.from({ length: 5 }, (_, index) => Object.freeze({ displayName: `Élève ${index + 1}`, factSheet: factSheet(`ELEVE_${String.fromCharCode(65 + index)}`, Array(9).fill(profile), BANDS[index % BANDS.length]) }));
    const plan = buildGroupPlan(catalog, inputs);
    expect(plan.nodes.map(({ minutes }) => minutes)).toEqual([80, 65, 65, 65, 65, 65, 65, 65, 65]);
    expect(plan.sessions.reduce((sum, session) => sum + session.contentMinutes, 0)).toBe(600);
    expect(plan.schedulingWarnings.length).toBeGreaterThan(0);
  });
});
