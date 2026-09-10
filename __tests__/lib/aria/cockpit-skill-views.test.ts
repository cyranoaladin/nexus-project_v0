import { getCockpitSkillGraph, getCockpitSkillGraphSummary } from '@/lib/aria/cockpit/skill-views';
import fixture from '@/e2e/fixtures/aria/cockpit-terminale-eds.json';

// The fixture's own `skillGraphs` array proves, from real compiled data, which
// real catalog course keys the canonical registry actually has a graph for —
// not a guess.
const REAL_COURSE_WITH_GRAPH = (fixture as { skillGraphs: { courseKey: string }[] })
  .skillGraphs[0]!.courseKey;

describe('getCockpitSkillGraph', () => {
  it('returns null for a course key not in the catalog at all', () => {
    expect(getCockpitSkillGraph('not-a-real-course-key')).toBeNull();
  });

  it('returns null for a real catalog course with no compiled skill graph (e.g. philosophie-terminale)', () => {
    expect(getCockpitSkillGraph('philosophie-terminale')).toBeNull();
  });

  it('adapts the canonical skill graph for a real, mapped course into the flat cockpit shape', () => {
    const graph = getCockpitSkillGraph(REAL_COURSE_WITH_GRAPH);
    expect(graph).not.toBeNull();
    expect(graph!.courseKey).toBe(REAL_COURSE_WITH_GRAPH);
    expect(graph!.domains.length).toBeGreaterThan(0);
    expect(graph!.competencies.length).toBeGreaterThan(0);
    for (const domain of graph!.domains) {
      expect(domain.competencyCount).toBe(
        graph!.competencies.filter((c) => c.domainId === domain.domainId).length,
      );
    }
  });
});

describe('getCockpitSkillGraphSummary', () => {
  it('reports unavailable for a course without a compiled graph', () => {
    expect(getCockpitSkillGraphSummary('philosophie-terminale')).toEqual({
      courseKey: 'philosophie-terminale',
      available: false,
      domainCount: 0,
      competencyCount: 0,
      version: null,
    });
  });

  it('reports availability and real counts for a course with a compiled graph', () => {
    const summary = getCockpitSkillGraphSummary(REAL_COURSE_WITH_GRAPH);
    const graph = getCockpitSkillGraph(REAL_COURSE_WITH_GRAPH)!;
    expect(summary).toEqual({
      courseKey: REAL_COURSE_WITH_GRAPH,
      available: true,
      domainCount: graph.domains.length,
      competencyCount: graph.competencies.length,
      version: graph.version,
    });
  });
});
