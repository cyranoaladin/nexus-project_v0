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

type SegmentView = Readonly<{
  nodeCpsId: string;
  sequenceOrder: number;
  segmentMinutes: number;
  totalMinutes: number;
  segmentPosition: 'WHOLE' | 'START' | 'CONTINUATION';
}>;

function minimumSplitNodeCount(nodes: readonly Readonly<{ minutes: number }>[]): number {
  const intervals = nodes.map((node, index) => ({
    start: nodes.slice(0, index).reduce((sum, current) => sum + current.minutes, 0),
    end: nodes.slice(0, index + 1).reduce((sum, current) => sum + current.minutes, 0),
  }));
  let minimum = Number.POSITIVE_INFINITY;
  for (let first = 105; first <= 135; first += 5) {
    for (let second = first + 105; second <= first + 135; second += 5) {
      for (let third = second + 105; third <= second + 135; third += 5) {
        for (let fourth = third + 105; fourth <= third + 135; fourth += 5) {
          if (600 - fourth < 105 || 600 - fourth > 135) continue;
          const edges = [0, first, second, third, fourth, 600];
          const fragments = intervals.map(({ start, end }) => edges.slice(0, -1)
            .map((sessionStart, index) => Math.max(0, Math.min(end, edges[index + 1]) - Math.max(start, sessionStart)))
            .filter((minutes) => minutes > 0));
          if (fragments.some((parts) => parts.length > 2 || parts.some((minutes) => minutes < 15))) continue;
          minimum = Math.min(minimum, fragments.filter((parts) => parts.length > 1).length);
        }
      }
    }
  }
  return minimum;
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

describe('A109-A115 deterministic allocation and internal global cuts', () => {
  it('finds a hard-window solution over twenty configurations without changing node durations', () => {
    let arbitrationCount = 0;
    for (let index = 0; index < 20; index += 1) {
      const inputs = members(index);
      const plan = buildGroupPlan(catalog, inputs);
      expect(plan.nodes.reduce((sum, node) => sum + node.minutes, 0)).toBe(600);
      expect(plan.sessions).toHaveLength(5);
      const segments = plan.sessions.flatMap(({ nodes }) => nodes) as unknown as readonly SegmentView[];
      const segmentedMinutes = new Map<string, number>();
      const segmentCounts = new Map<string, number>();
      for (const segment of segments) {
        segmentedMinutes.set(segment.nodeCpsId, (segmentedMinutes.get(segment.nodeCpsId) ?? 0) + segment.segmentMinutes);
        segmentCounts.set(segment.nodeCpsId, (segmentCounts.get(segment.nodeCpsId) ?? 0) + 1);
        expect(segment.segmentMinutes).toBeGreaterThanOrEqual(15);
      }
      expect(segmentedMinutes).toEqual(new Map(plan.nodes.map(({ nodeCpsId, minutes }) => [nodeCpsId, minutes])));
      expect(Math.max(...segmentCounts.values())).toBeLessThanOrEqual(2);
      expect(segments.map(({ sequenceOrder }) => sequenceOrder)).toEqual([...segments.map(({ sequenceOrder }) => sequenceOrder)].sort((a, b) => a - b));
      expect([...new Set(segments.map(({ sequenceOrder }) => sequenceOrder))]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(segmentCounts.size - [...segmentCounts.values()].filter((count) => count === 1).length).toBe(minimumSplitNodeCount(plan.nodes));
      const outside = plan.sessions.some(({ contentMinutes }) => contentMinutes < 105 || contentMinutes > 135);
      expect(plan.schedulingStatus === 'TEACHER_ARBITRATION_REQUIRED').toBe(outside);
      if (outside) { arbitrationCount += 1; expect(plan.schedulingWarnings.length).toBeGreaterThan(0); }
      expect(buildGroupPlan(catalog, inputs)).toEqual(plan);
    }
    expect(arbitrationCount).toBe(0);
  });

  it('handles the A114 counterexample without changing the 600-minute total', () => {
    const target = ['MAITRISE_FRAGILE', 'ERREUR_CONFIANTE', 'ERREUR_CONFIANTE', 'ERREUR_CONFIANTE', 'MAITRISE_FRAGILE', 'DIVISE', 'DIVISE', 'ERREUR_CONFIANTE', 'MAITRISE'] as const;
    const inputs = members(0, 5).map((member, studentIndex) => ({
      ...member,
      factSheet: factSheet(member.factSheet.student.alias, target.map((profile) => profile === 'DIVISE' ? (studentIndex < 3 ? 'MAITRISE' : 'ERREUR_CONFIANTE') : profile), member.factSheet.groupBand),
    }));
    const plan = buildGroupPlan(catalog, inputs);
    expect(plan.nodes.reduce((sum, node) => sum + node.minutes, 0)).toBe(600);
    expect(plan.sessions).toHaveLength(5);
    expect(plan.schedulingStatus).toBe('READY');
    expect(plan.sessions.every(({ contentMinutes }) => contentMinutes >= 105 && contentMinutes <= 135)).toBe(true);
  });

  it.each(['MAITRISE', 'ERREUR_CONFIANTE'] as const)('keeps nine identical profiles deterministic: %s', (profile) => {
    const inputs = Array.from({ length: 5 }, (_, index) => Object.freeze({ displayName: `Élève ${index + 1}`, factSheet: factSheet(`ELEVE_${String.fromCharCode(65 + index)}`, Array(9).fill(profile), BANDS[index % BANDS.length]) }));
    const plan = buildGroupPlan(catalog, inputs);
    expect(plan.nodes.map(({ minutes }) => minutes)).toEqual([80, 65, 65, 65, 65, 65, 65, 65, 65]);
    expect(plan.sessions.reduce((sum, session) => sum + session.contentMinutes, 0)).toBe(600);
    expect(plan.schedulingStatus).toBe('READY');
    expect(plan.schedulingWarnings).toEqual([]);
  });
});
