import { checkKnownPlacementMappings } from '@/scripts/aria/check-rag-placement-course-mapping';

describe('checkKnownPlacementMappings — standing regression guard', () => {
  it('reports zero failures against the real curriculum catalog for the known NSI placements', () => {
    expect(checkKnownPlacementMappings()).toEqual([]);
  });

  it('reports a labeled failure when a known placement stops resolving to its expected courseKey', () => {
    jest.resetModules();
    jest.doMock('@/lib/aria/infrastructure/rag/rag-placement-to-course-key', () => ({
      mapBootstrapPlacementToCourseKey: (placement: { readonly niveau: string }) =>
        (placement.niveau === 'premiere'
          ? { outcome: 'MATCHED', courseKey: 'eds-nsi-premiere' }
          : { outcome: 'PLACEMENT_COURSE_MAPPING_UNKNOWN' }),
      catalogPlacementSignatureCount: () => 1,
    }));

    jest.isolateModules(() => {
      const { checkKnownPlacementMappings: checkWithBrokenMapping } =
        require('@/scripts/aria/check-rag-placement-course-mapping') as
          typeof import('@/scripts/aria/check-rag-placement-course-mapping');
      const failures = checkWithBrokenMapping();
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatch(/NSI Terminale/);
    });

    jest.dontMock('@/lib/aria/infrastructure/rag/rag-placement-to-course-key');
  });
});
