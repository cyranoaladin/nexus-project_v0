import {
  allCourseKeys,
  projectHubResources,
  recommendedResourcesForCourse,
  resourcesForCourse,
} from '@/lib/aria/cockpit/resources';
import type { EleveHub, EleveHubResource } from '@/components/dashboard/eleve/types';

function resource(overrides: Partial<EleveHubResource>): EleveHubResource {
  return {
    id: 'r1',
    category: 'OFFICIAL_PROGRAM',
    title: 'Ressource',
    type: 'PDF',
    ...overrides,
  };
}

function hub(byCategory: Partial<EleveHub['byCategory']>): EleveHub {
  return {
    byCategory: byCategory as EleveHub['byCategory'],
    totalCount: 0,
    recentlyAddedCount: 0,
  };
}

// Real, non-fabricated catalog fixtures (lib/aria/curriculum/catalog.ts):
// `maths-premiere-stmg` (chatSubject MATHEMATIQUES, not approximate) and the
// three SES STMG modules (all `approximate: true`, distinguished only by
// their explicit hubResourceIds).
const SGN_RESOURCE_ID = 'interactive:sgn-stmg';

describe('projectHubResources', () => {
  it('excludes billing categories entirely', () => {
    const projected = projectHubResources(
      hub({ INVOICE: [resource({ id: 'inv-1', category: 'INVOICE' })] }),
      [],
    );
    expect(projected).toEqual([]);
  });

  it('attaches a resource to a course by explicit hubResourceIds match, not to sibling approximate-subject modules', () => {
    const projected = projectHubResources(
      hub({ OFFICIAL_PROGRAM: [resource({ id: SGN_RESOURCE_ID, subject: 'SES' })] }),
      ['sgn-premiere-stmg', 'management-premiere-stmg', 'droit-eco-premiere-stmg'],
    );
    expect(projected).toHaveLength(1);
    expect(projected[0]!.courseKeys).toEqual(['sgn-premiere-stmg']);
  });

  it('attaches a resource by subject match only when the course chatSubject is not an approximation', () => {
    const projected = projectHubResources(
      hub({ OFFICIAL_PROGRAM: [resource({ id: 'doc-1', subject: 'MATHEMATIQUES' })] }),
      ['maths-premiere-stmg'],
    );
    expect(projected[0]!.courseKeys).toEqual(['maths-premiere-stmg']);
  });

  it('leaves an unrelated resource attached to no course, without hiding it', () => {
    const projected = projectHubResources(
      hub({ OFFICIAL_PROGRAM: [resource({ id: 'unrelated', subject: undefined })] }),
      ['maths-premiere-stmg'],
    );
    expect(projected).toHaveLength(1);
    expect(projected[0]!.courseKeys).toEqual([]);
  });

  it('ignores an unknown candidate course key rather than throwing', () => {
    const projected = projectHubResources(
      hub({ OFFICIAL_PROGRAM: [resource({ id: SGN_RESOURCE_ID, subject: 'SES' })] }),
      ['not-a-real-course-key' as never],
    );
    expect(projected[0]!.courseKeys).toEqual([]);
  });
});

describe('resourcesForCourse', () => {
  it('returns an empty list for an unknown course key', () => {
    expect(resourcesForCourse(hub({}), 'not-a-real-course-key' as never)).toEqual([]);
  });

  it('returns only resources actually attached to the given course', () => {
    const h = hub({
      OFFICIAL_PROGRAM: [
        resource({ id: SGN_RESOURCE_ID, subject: 'SES' }),
        resource({ id: 'other', subject: undefined }),
      ],
    });
    const result = resourcesForCourse(h, 'sgn-premiere-stmg');
    expect(result.map((r) => r.id)).toEqual([SGN_RESOURCE_ID]);
  });
});

describe('recommendedResourcesForCourse', () => {
  // `maths-premiere-stmg` carries three real hubResourceIds — enough to test
  // priority ordering across three genuinely-attached resources.
  it('orders by editorial priority and truncates to the limit', () => {
    const h = hub({
      COACH_RESOURCE: [
        resource({ id: 'interactive:maths-stmg-skill-graph', category: 'COACH_RESOURCE' }),
      ],
      OFFICIAL_PROGRAM: [
        resource({ id: 'interactive:maths-stmg', category: 'OFFICIAL_PROGRAM' }),
      ],
      INTERACTIVE_PROGRAM: [
        resource({ id: 'interactive:maths-stmg-qcm', category: 'INTERACTIVE_PROGRAM' }),
      ],
    });
    const result = recommendedResourcesForCourse(h, 'maths-premiere-stmg', 2);
    expect(result).toHaveLength(2);
    expect(result[0]!.category).toBe('INTERACTIVE_PROGRAM');
    expect(result[1]!.category).toBe('OFFICIAL_PROGRAM');
  });

  it('places a category absent from the priority list last, after every prioritized category', () => {
    const h = hub({
      RAG_REFERENCE: [resource({ id: 'interactive:maths-stmg', category: 'RAG_REFERENCE' })],
      OFFICIAL_PROGRAM: [
        resource({ id: 'interactive:maths-stmg-qcm', category: 'OFFICIAL_PROGRAM' }),
      ],
    });
    const result = recommendedResourcesForCourse(h, 'maths-premiere-stmg', 5);
    expect(result.map((r) => r.category)).toEqual(['OFFICIAL_PROGRAM', 'RAG_REFERENCE']);
  });

  it('weighs an absent-from-priority-list item as the new element being inserted during the sort', () => {
    // V8's sort for small arrays is a binary insertion sort: the FIRST
    // element in source order is never passed as the comparator's first
    // argument (it starts as the trivially-sorted prefix); only elements
    // from index 1 onward get inserted by comparison. Placing the
    // absent-category item after a prioritized one (source order) is what
    // actually exercises the `ia === -1` branch for the first argument.
    const h = hub({
      STAGE_BILAN: [resource({ id: 'interactive:maths-stmg-qcm', category: 'STAGE_BILAN' })],
      RAG_REFERENCE: [resource({ id: 'interactive:maths-stmg', category: 'RAG_REFERENCE' })],
    });
    const result = recommendedResourcesForCourse(h, 'maths-premiere-stmg', 5);
    expect(result.map((r) => r.category)).toEqual(['STAGE_BILAN', 'RAG_REFERENCE']);
  });

  it('defaults the limit to 3 when none is given', () => {
    const h = hub({
      OFFICIAL_PROGRAM: [
        resource({ id: 'interactive:maths-stmg', category: 'OFFICIAL_PROGRAM' }),
        resource({ id: 'interactive:maths-stmg-qcm', category: 'OFFICIAL_PROGRAM' }),
        resource({ id: 'interactive:maths-stmg-skill-graph', category: 'OFFICIAL_PROGRAM' }),
      ],
    });
    const result = recommendedResourcesForCourse(h, 'maths-premiere-stmg');
    expect(result).toHaveLength(3);
  });

  it('never returns a negative-length slice for a limit of 0', () => {
    const h = hub({
      OFFICIAL_PROGRAM: [resource({ id: SGN_RESOURCE_ID, subject: 'SES' })],
    });
    expect(recommendedResourcesForCourse(h, 'sgn-premiere-stmg', 0)).toEqual([]);
  });
});

describe('allCourseKeys', () => {
  it('returns the real, non-empty catalog key set including a known course', () => {
    const keys = allCourseKeys();
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toContain('sgn-premiere-stmg');
  });
});
