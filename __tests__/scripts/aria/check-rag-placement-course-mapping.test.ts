import { checkKnownPlacementMappings } from '@/scripts/aria/check-rag-placement-course-mapping';

describe('checkKnownPlacementMappings — standing regression guard', () => {
  it('reports zero failures against the real curriculum catalog for the known NSI placements', () => {
    expect(checkKnownPlacementMappings()).toEqual([]);
  });

  it('reports a labeled failure when a known placement stops resolving to its expected courseKey', () => {
    jest.resetModules();
    // Correctly resolves every known placement EXCEPT NSI Terminale, which is
    // deliberately broken to prove the guard labels exactly the broken case
    // and never cascades a single break into unrelated known placements.
    const EXPECTED_BY_SIGNATURE: Record<string, string> = {
      'nsi premiere generale specialite': 'eds-nsi-premiere',
      'ses premiere generale specialite': 'eds-ses-premiere',
      'ses terminale generale specialite': 'eds-ses-terminale',
      'svt premiere generale specialite': 'eds-svt-premiere',
      'svt terminale generale specialite': 'eds-svt-terminale',
      'hggsp premiere generale specialite': 'eds-hggsp-premiere',
      'hggsp terminale generale specialite': 'eds-hggsp-terminale',
      'hlp premiere generale specialite': 'eds-hlp-premiere',
      'hlp terminale generale specialite': 'eds-hlp-terminale',
      'dgemc terminale generale option': 'opt-dgemc-terminale',
    };
    jest.doMock('@/lib/aria/infrastructure/rag/rag-placement-to-course-key', () => ({
      mapBootstrapPlacementToCourseKey: (placement: {
        readonly matiere: string;
        readonly niveau: string;
        readonly voie: string;
        readonly statut_enseignement: string;
      }) => {
        const signature = [placement.matiere, placement.niveau, placement.voie, placement.statut_enseignement]
          .join(' ');
        const courseKey = EXPECTED_BY_SIGNATURE[signature];
        return courseKey
          ? { outcome: 'MATCHED', courseKey }
          : { outcome: 'PLACEMENT_COURSE_MAPPING_UNKNOWN' };
      },
      catalogPlacementSignatureCount: () => Object.keys(EXPECTED_BY_SIGNATURE).length,
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
