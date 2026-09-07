/**
 * The pure primitive a future real C05a importer needs: RAG `BootstrapPlacement`
 * vocabulary → Nexus `courseKey`. Fail-closed, never first-match.
 */

import { listCoursesWithProgrammeSelector } from '@/lib/curriculum/catalog';
import {
  buildCourseKeysBySignature,
  catalogPlacementSignatureCount,
  mapBootstrapPlacementToCourseKey,
  mapRagPlacementVocabularyToCourseKey,
  resolvePlacementFromIndex,
} from '@/lib/aria/infrastructure/rag/rag-placement-to-course-key';

jest.mock('@/lib/curriculum/catalog', () => {
  const actual = jest.requireActual('@/lib/curriculum/catalog');
  return {
    ...actual,
    listCoursesWithProgrammeSelector: jest.fn(actual.listCoursesWithProgrammeSelector),
  };
});

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
    const spy = listCoursesWithProgrammeSelector as jest.Mock;
    // Forces the memoized index to build (or confirms it is already built
    // from an earlier test in this file — either way, the real assertion
    // below is about the CHANGE in call count from here on, not its
    // absolute value).
    mapBootstrapPlacementToCourseKey({
      matiere: 'nsi', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite',
    });
    const callsAfterFirstBuild = spy.mock.calls.length;
    const first = catalogPlacementSignatureCount();
    const second = catalogPlacementSignatureCount();
    mapBootstrapPlacementToCourseKey({
      matiere: 'nsi', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite',
    });
    expect(spy.mock.calls.length).toBe(callsAfterFirstBuild);
    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0);
  });
});

/**
 * Standing regression guard: every one of the 11 collections in the
 * sealed, promoted RAG release must resolve to its exact Nexus courseKey —
 * against the REAL catalog, not a synthetic fixture. Evidence for these 11
 * tuples: `production-profile-gate-2026-2027-v1`
 * (`services/rag-pedago/data/releases/prerentree_2026_2027/profile_gate/production-profile-gate.release.json`
 * and its sibling `subjects/*.release.json` files), producer
 * `cyranoaladin/RAG`, commit `dd0ae3d9490703c0c180b12a7fce11f5c222427d`.
 * This is contract-test input evidencing the real producer release — it is
 * NOT a second runtime mapping authority; runtime authority remains the
 * Nexus curriculum catalog plus the single forward mapping tables in
 * `production-academic-identity.ts`.
 */
describe('RAG sealed release production-profile-gate-2026-2027-v1 — 11-collection mapping guard', () => {
  const producer = { repository: 'cyranoaladin/RAG', commit: 'dd0ae3d9490703c0c180b12a7fce11f5c222427d' };
  const releaseId = 'production-profile-gate-2026-2027-v1';

  it.each([
    [{ matiere: 'dgemc', niveau: 'terminale', voie: 'generale', statut_enseignement: 'option' }, 'opt-dgemc-terminale'],
    [{ matiere: 'hggsp', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' }, 'eds-hggsp-premiere'],
    [{ matiere: 'hggsp', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' }, 'eds-hggsp-terminale'],
    [{ matiere: 'hlp', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' }, 'eds-hlp-premiere'],
    [{ matiere: 'hlp', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' }, 'eds-hlp-terminale'],
    [{ matiere: 'nsi', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' }, 'eds-nsi-premiere'],
    [{ matiere: 'nsi', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' }, 'eds-nsi-terminale'],
    [{ matiere: 'ses', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' }, 'eds-ses-premiere'],
    [{ matiere: 'ses', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' }, 'eds-ses-terminale'],
    [{ matiere: 'svt', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' }, 'eds-svt-premiere'],
    [{ matiere: 'svt', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' }, 'eds-svt-terminale'],
  ] as const)('%o -> %s (sealed release %s, producer %s @ %s)', (placement, expectedCourseKey) => {
    expect(mapBootstrapPlacementToCourseKey(placement)).toEqual({
      outcome: 'MATCHED',
      courseKey: expectedCourseKey,
    });
    // Fixed reference values above, asserted once per suite run so a typo
    // in the evidence header itself would fail loudly.
    expect(producer.repository).toBe('cyranoaladin/RAG');
    expect(producer.commit).toBe('dd0ae3d9490703c0c180b12a7fce11f5c222427d');
    expect(releaseId).toBe('production-profile-gate-2026-2027-v1');
  });

  it('all 11 sealed-release collections resolve to 11 DISTINCT course keys — no accidental collapse', () => {
    const tuples = [
      { matiere: 'dgemc', niveau: 'terminale', voie: 'generale', statut_enseignement: 'option' },
      { matiere: 'hggsp', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' },
      { matiere: 'hggsp', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' },
      { matiere: 'hlp', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' },
      { matiere: 'hlp', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' },
      { matiere: 'nsi', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' },
      { matiere: 'nsi', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' },
      { matiere: 'ses', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' },
      { matiere: 'ses', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' },
      { matiere: 'svt', niveau: 'premiere', voie: 'generale', statut_enseignement: 'specialite' },
      { matiere: 'svt', niveau: 'terminale', voie: 'generale', statut_enseignement: 'specialite' },
    ] as const;
    const results = tuples.map((tuple) => mapBootstrapPlacementToCourseKey(tuple));
    expect(results.every((result) => result.outcome === 'MATCHED')).toBe(true);
    const courseKeys = results.map((result) => (result as { courseKey: string }).courseKey);
    expect(new Set(courseKeys).size).toBe(11);
  });

  it('DGEMC resolves through GENERAL_TECHNOLOGICAL: both a generale and a technologique voie match the same current courseKey', () => {
    const generale = mapBootstrapPlacementToCourseKey({
      matiere: 'dgemc', niveau: 'terminale', voie: 'generale', statut_enseignement: 'option',
    });
    const technologique = mapBootstrapPlacementToCourseKey({
      matiere: 'dgemc', niveau: 'terminale', voie: 'technologique', statut_enseignement: 'option',
    });
    expect(generale).toEqual({ outcome: 'MATCHED', courseKey: 'opt-dgemc-terminale' });
    expect(technologique).toEqual({ outcome: 'MATCHED', courseKey: 'opt-dgemc-terminale' });
  });
});
