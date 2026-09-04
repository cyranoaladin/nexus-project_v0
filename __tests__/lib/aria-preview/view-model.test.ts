import { buildAriaPreviewData } from '@/lib/aria-preview/view-model';
import { listCourses } from '@/lib/curriculum/catalog';

describe('ARIA preview — view model', () => {
  it('renders every canonical course from the catalog, none invented', () => {
    const data = buildAriaPreviewData();
    const catalogKeys = listCourses().map((course) => course.courseKey).sort();
    const viewModelKeys = data.courses.map((course) => course.courseKey).sort();
    expect(viewModelKeys).toEqual(catalogKeys);
  });

  it('never produces a duplicate courseKey', () => {
    const data = buildAriaPreviewData();
    const keys = data.courses.map((course) => course.courseKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('derives specialty limits from the catalog specialtyRules, not a hardcoded value', () => {
    const data = buildAriaPreviewData();
    const premiere = data.specialtyRules.find((rule) => rule.gradeLevel === 'PREMIERE');
    const terminale = data.specialtyRules.find((rule) => rule.gradeLevel === 'TERMINALE');
    expect(premiere?.maxSpecialties).toBe(3);
    expect(terminale?.maxSpecialties).toBe(2);
    expect(premiere?.sources.length).toBeGreaterThan(0);
    expect(terminale?.sources.length).toBeGreaterThan(0);
  });

  it('preserves the canonical specialty-rule note instead of dropping it', () => {
    const data = buildAriaPreviewData();
    const premiere = data.specialtyRules.find((rule) => rule.gradeLevel === 'PREMIERE');
    const terminale = data.specialtyRules.find((rule) => rule.gradeLevel === 'TERMINALE');
    expect(premiere?.note).toEqual(expect.stringContaining('abandonnée'));
    expect(terminale?.note).toEqual(expect.stringContaining('eds1'));
  });

  it('computes the coverage matrix from real courses, never a hardcoded row count', () => {
    const data = buildAriaPreviewData();
    expect(data.coverageMatrix.length).toBeGreaterThan(0);
    const totalCoursesInMatrix = data.coverageMatrix.reduce((sum, row) => sum + row.courseCount, 0);
    // Each course can appear in more than one track, so the matrix total is a
    // sum over (gradeLevel, track) pairs, always >= the distinct course count.
    expect(totalCoursesInMatrix).toBeGreaterThanOrEqual(data.courses.length);
  });

  it('exposes the real RAG canonical volumetry only for the NSI Terminale corpus', () => {
    const data = buildAriaPreviewData();
    const nsiTerminale = data.courses.find((course) => course.courseKey === 'eds-nsi-terminale');
    expect(nsiTerminale?.ragVolumetry).toEqual({
      releaseId: 'production-profile-gate-2026-2027-v1',
      physicalCollection: 'rag_nexus_nsi_terminale_specialite',
      expectedArtifacts: 47,
      expectedChunks: 904,
    });

    for (const course of data.courses) {
      if (course.courseKey === 'eds-nsi-terminale') continue;
      expect(course.ragVolumetry).toBeNull();
    }
  });

  it('never reports RAG or chat as READY — only IN_QUALIFICATION or NOT_CONFIGURED', () => {
    const data = buildAriaPreviewData();
    for (const course of data.courses) {
      expect(course.summary.ragStatus).not.toBe('READY');
      expect(course.summary.chatStatus).not.toBe('READY');
    }
  });

  it('derives grade levels and tracks from the catalog, not an invented full grid', () => {
    const data = buildAriaPreviewData();
    // The catalog does not declare SIXIEME/CINQUIEME: they must not appear.
    expect(data.gradeLevels).not.toContain('SIXIEME');
    expect(data.gradeLevels).not.toContain('CINQUIEME');
    expect(data.gradeLevels.length).toBeGreaterThan(0);
    for (const gradeLevel of data.gradeLevels) {
      expect(data.tracksByGradeLevel[gradeLevel]?.length).toBeGreaterThan(0);
    }
  });
});
