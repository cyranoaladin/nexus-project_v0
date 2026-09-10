import { adaptSkillGraph, getCockpitSkillGraph, getCockpitSkillGraphSummary } from '@/lib/aria/cockpit/skill-views';
import type { AriaSkillGraph as CanonicalAriaSkillGraph } from '@/lib/aria/curriculum/skill-graph';
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

  it('returns null for an empty-string course key', () => {
    expect(getCockpitSkillGraph('')).toBeNull();
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

  // Every one of the 8 real courses this module maps
  // (COURSE_KEY_TO_CANONICAL_REGISTRY_KEY) to a canonical registry key
  // currently has a real compiled graph behind it — verified directly
  // (`getCockpitSkillGraph` returns non-null for all 8, checked via a
  // standalone script against the real catalog + canonical registry).
  // That means `adaptSkillGraph`'s two defensive guards (an unmapped
  // courseKey reaching the map lookup; a mapped key whose canonical
  // registry entry is missing) are currently unreachable through the
  // public API with real data — they exist for future drift between the
  // catalog and the registry, not because today's data exercises them.
  // This exercises the full mapping for real instead of just one entry.
  it.each([
    'maths-premiere-eds',
    'nsi-premiere-eds',
    'maths-premiere-stmg',
    'sgn-premiere-stmg',
    'management-premiere-stmg',
    'droit-eco-premiere-stmg',
    'maths-terminale-eds',
    'nsi-terminale-eds',
  ])('resolves a real compiled graph for every mapped course (%s)', (courseKey) => {
    const graph = getCockpitSkillGraph(courseKey);
    expect(graph).not.toBeNull();
    expect(graph!.courseKey).toBe(courseKey);
    expect(graph!.domains.length).toBeGreaterThan(0);
  });
});

describe('adaptSkillGraph (direct, via the injectable canonical-lookup seam)', () => {
  // These two guards are genuinely unreachable through the public API with
  // real data today (see the it.each block above) — exercised directly here
  // instead, the same way import-resource-registry.ts's own unreachable
  // AMBIGUOUS branch is: an injectable seam, not fabricated catalog data.
  it('returns null when the course key has no canonical registry mapping at all', () => {
    expect(adaptSkillGraph('not-a-real-course-key', 'irrelevant-definition-key')).toBeNull();
  });

  it('returns null when the mapped registry key has no entry in the canonical registry', () => {
    expect(
      adaptSkillGraph('maths-premiere-eds', 'irrelevant-definition-key', () => null),
    ).toBeNull();
  });

  it('maps chapterId to null (not undefined) when the canonical competency omits it, and preserves it when present', () => {
    const fakeSource: CanonicalAriaSkillGraph = {
      courseKey: 'eds-maths-premiere',
      totalCompetencies: 2,
      domains: [{
        id: 'eds-maths-premiere:d1',
        rawDomainId: 'd1',
        label: 'Domaine 1',
        competencies: [
          { id: 'eds-maths-premiere:s1', rawSkillId: 's1', label: 'Sans chapitre' },
          { id: 'eds-maths-premiere:s2', rawSkillId: 's2', label: 'Avec chapitre', chapterId: 'ch-1', prerequisite: true },
        ],
      }],
    };
    const graph = adaptSkillGraph('maths-premiere-eds', 'def-key', () => fakeSource);
    expect(graph).not.toBeNull();
    expect(graph!.competencies).toEqual([
      { id: 'eds-maths-premiere:s1', skillId: 's1', label: 'Sans chapitre', domainId: 'd1', chapterId: null, prerequisite: false },
      { id: 'eds-maths-premiere:s2', skillId: 's2', label: 'Avec chapitre', domainId: 'd1', chapterId: 'ch-1', prerequisite: true },
    ]);
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
