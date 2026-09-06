/**
 * The pure primitive a future real C05a importer needs: RAG `BootstrapPlacement`
 * vocabulary → Nexus `courseKey`. Fail-closed, never first-match.
 */

import {
  buildCourseKeysBySignature,
  catalogPlacementSignatureCount,
  mapBootstrapPlacementToCourseKey,
  mapRagPlacementVocabularyToCourseKey,
  resolvePlacementFromIndex,
} from '@/lib/aria/infrastructure/rag/rag-placement-to-course-key';

describe('RAG placement → Nexus courseKey mapping', () => {
  it('maps the known NSI Première placement to eds-nsi-premiere', () => {
    const result = mapBootstrapPlacementToCourseKey({
      matiere: 'nsi',
      niveau: 'premiere',
      voie: 'generale',
      statut_enseignement: 'specialite',
    });
    expect(result).toEqual({ outcome: 'MATCHED', courseKey: 'eds-nsi-premiere' });
  });

  it('maps the known NSI Terminale placement to eds-nsi-terminale', () => {
    const result = mapBootstrapPlacementToCourseKey({
      matiere: 'nsi',
      niveau: 'terminale',
      voie: 'generale',
      statut_enseignement: 'specialite',
    });
    expect(result).toEqual({ outcome: 'MATCHED', courseKey: 'eds-nsi-terminale' });
  });

  it('the two known NSI placements map to two distinct course keys', () => {
    const premiere = mapBootstrapPlacementToCourseKey({
      matiere: 'nsi', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite',
    });
    const terminale = mapBootstrapPlacementToCourseKey({
      matiere: 'nsi', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite',
    });
    expect(premiere.outcome).toBe('MATCHED');
    expect(terminale.outcome).toBe('MATCHED');
    expect(premiere).not.toEqual(terminale);
  });

  it('fails closed with PLACEMENT_COURSE_MAPPING_UNKNOWN for an unrecognized vocabulary', () => {
    expect(mapBootstrapPlacementToCourseKey({
      matiere: 'philosophie-des-nombres-imaginaires',
      niveau: 'premiere',
      voie: 'generale',
      statut_enseignement: 'specialite',
    })).toEqual({ outcome: 'PLACEMENT_COURSE_MAPPING_UNKNOWN' });
  });

  it('fails closed with PLACEMENT_COURSE_MAPPING_UNKNOWN for an unmapped niveau', () => {
    expect(mapBootstrapPlacementToCourseKey({
      matiere: 'nsi',
      niveau: 'postbac',
      voie: 'generale',
      statut_enseignement: 'specialite',
    })).toEqual({ outcome: 'PLACEMENT_COURSE_MAPPING_UNKNOWN' });
  });

  it('never returns a first-match result for an ambiguous vocabulary', () => {
    // The real curriculum catalogue has zero colliding signatures today, so
    // this branch is proven against a synthetic course list injected through
    // the exported pure index-builder, not the real catalog.
    const index = buildCourseKeysBySignature([
      {
        courseKey: 'course-a',
        gradeLevel: 'PREMIERE',
        tracks: ['EDS_GENERALE'],
        programmeSelector: { subject: 'NSI', subjectVariant: 'SPECIALITY' },
      },
      {
        courseKey: 'course-b',
        gradeLevel: 'PREMIERE',
        tracks: ['EDS_GENERALE'],
        programmeSelector: { subject: 'NSI', subjectVariant: 'SPECIALITY' },
      },
    ]);
    const result = resolvePlacementFromIndex(index, {
      matiere: 'nsi', niveau: 'premiere', voie: 'generale', statutEnseignement: 'specialite',
    });
    expect(result).toEqual({
      outcome: 'PLACEMENT_COURSE_MAPPING_AMBIGUOUS',
      courseKeys: ['course-a', 'course-b'],
    });
  });

  it('deduplicates the same course matched through two tracks into one match, not an ambiguity', () => {
    const index = buildCourseKeysBySignature([
      {
        courseKey: 'tc-maths-seconde',
        gradeLevel: 'SECONDE',
        tracks: ['STMG', 'STI2D'],
        programmeSelector: { subject: 'MATHEMATICS', subjectVariant: 'COMMON' },
      },
    ]);
    const result = resolvePlacementFromIndex(index, {
      matiere: 'mathematiques', niveau: 'seconde', voie: 'technologique', statutEnseignement: 'tronc_commun',
    });
    expect(result).toEqual({ outcome: 'MATCHED', courseKey: 'tc-maths-seconde' });
  });

  it('buildCourseKeysBySignature skips a course that declares no programmeSelector at all', () => {
    const index = buildCourseKeysBySignature([
      {
        courseKey: 'tc-grand-oral-terminale',
        gradeLevel: 'TERMINALE',
        tracks: ['EDS_GENERALE'],
        programmeSelector: undefined,
      },
      {
        courseKey: 'eds-nsi-terminale',
        gradeLevel: 'TERMINALE',
        tracks: ['EDS_GENERALE'],
        programmeSelector: { subject: 'NSI', subjectVariant: 'SPECIALITY' },
      },
    ]);
    const result = resolvePlacementFromIndex(index, {
      matiere: 'nsi', niveau: 'terminale', voie: 'generale', statutEnseignement: 'specialite',
    });
    expect(result).toEqual({ outcome: 'MATCHED', courseKey: 'eds-nsi-terminale' });
    expect(index.size).toBe(1);
  });

  it('is pure and total: the same input always returns the same result', () => {
    const input = {
      matiere: 'nsi', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite',
    } as const;
    const first = mapBootstrapPlacementToCourseKey(input);
    const second = mapBootstrapPlacementToCourseKey(input);
    expect(first).toEqual(second);
  });

  it('the vocabulary-level entry point agrees with the BootstrapPlacement adapter', () => {
    expect(mapRagPlacementVocabularyToCourseKey({
      matiere: 'nsi', niveau: 'premiere', voie: 'generale', statutEnseignement: 'specialite',
    })).toEqual(mapBootstrapPlacementToCourseKey({
      matiere: 'nsi', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite',
    }));
  });

  it('catalogPlacementSignatureCount reads the same memoized index the mapper builds, never a second one', () => {
    // Forces the memoized index to build via a real mapping call first.
    mapBootstrapPlacementToCourseKey({
      matiere: 'nsi', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite',
    });
    const first = catalogPlacementSignatureCount();
    const second = catalogPlacementSignatureCount();
    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0);
  });
});
