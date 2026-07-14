import {
  CatalogError,
  allPacks,
  resolveEligiblePack,
  validatePack,
  type CurriculumPack,
} from '@/lib/bilans/catalog/service';

const selection = {
  subject: 'NSI' as const,
  grade: 'TERMINALE' as const,
  schoolYear: '2026-2027',
};

function expectCatalogError(action: () => unknown, code: string): void {
  let error: unknown;
  try {
    action();
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(CatalogError);
  expect(error).toMatchObject({ code });
}

function createPublishedPack(overrides: Partial<CurriculumPack> = {}): CurriculumPack {
  return {
    id: 'nsi-terminale-v1',
    status: 'PUBLISHED',
    selection,
    versions: {
      curriculum: '2026.1',
      assessment: '2026.1',
      scoring: '2026.1',
      report: '2026.1',
      corpus: '2026.1',
    },
    checksums: {
      curriculum: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      assessment: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      scoring: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      report: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      corpus: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    },
    regulatory: {
      officialSourceUrl: 'https://www.education.gouv.fr/programmes/nsi-terminale',
      officialSourceIdentifier: 'BOEN-NSI-TLE-2026',
      consultedAt: '2026-07-14',
      effectiveFrom: '2026-09-01',
      sourceChecksum: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    },
    pedagogicalReviewer: 'Camille Martin',
    competencies: [
      { id: 'nsi.algorithmique', questionIds: ['q-algorithmique'] },
      { id: 'nsi.sql', prerequisiteIds: ['nsi.algorithmique'], questionIds: ['q-sql'] },
    ],
    questionIds: ['q-algorithmique', 'q-sql'],
    minimumCoverage: { competencies: 2, questions: 2 },
    ...overrides,
  };
}

describe('versioned curriculum catalogue', () => {
  it('reports a known NSI terminale review pack as not published', () => {
    expectCatalogError(() => resolveEligiblePack(selection), 'PACK_NOT_PUBLISHED');
  });

  it('selects the published pack when a review-required match appears first', () => {
    const reviewRequiredPack = createPublishedPack({ id: 'nsi-terminale-review', status: 'REVIEW_REQUIRED' });
    const publishedPack = createPublishedPack({ id: 'nsi-terminale-published' });

    expect(resolveEligiblePack(selection, [reviewRequiredPack, publishedPack]).id).toBe('nsi-terminale-published');
  });

  it('rejects an ambiguous selection with multiple published packs', () => {
    expectCatalogError(
      () => resolveEligiblePack(selection, [createPublishedPack({ id: 'nsi-a' }), createPublishedPack({ id: 'nsi-b' })]),
      'PACK_AMBIGUOUS_SELECTION',
    );
  });

  it('does not allow importers to promote a review-required catalogue pack', () => {
    const nsiTerminalePack = allPacks.find((pack) => pack.selection.subject === 'NSI' && pack.selection.grade === 'TERMINALE');
    expect(nsiTerminalePack).toBeDefined();

    expect(() => {
      (nsiTerminalePack as CurriculumPack).status = 'PUBLISHED';
    }).toThrow(TypeError);
    expectCatalogError(() => resolveEligiblePack(selection), 'PACK_NOT_PUBLISHED');
  });

  it('reports NSI seconde as not eligible', () => {
    expectCatalogError(() => resolveEligiblePack({ ...selection, grade: 'SECONDE' }), 'PACK_NOT_ELIGIBLE');
  });

  it.each([
    { subject: 'FRANCAIS' as const, grade: 'TERMINALE' as const, schoolYear: '2026-2027' },
    { ...selection, schoolYear: '2025-2026' },
  ])('rejects unsupported or wrong-year selections', (unsupportedSelection) => {
    expectCatalogError(() => resolveEligiblePack(unsupportedSelection), 'PACK_NOT_ELIGIBLE');
  });

  it('rejects a published pack without complete regulatory metadata', () => {
    const pack = createPublishedPack({
      regulatory: { ...createPublishedPack().regulatory, officialSourceIdentifier: '' },
    });

    expectCatalogError(() => validatePack(pack), 'PACK_INVALID_REGULATORY_METADATA');
  });

  it('rejects impossible ISO calendar dates in regulatory metadata', () => {
    const pack = createPublishedPack({
      regulatory: { ...createPublishedPack().regulatory, consultedAt: '2026-02-30' },
    });

    expectCatalogError(() => validatePack(pack), 'PACK_INVALID_REGULATORY_METADATA');
  });

  it('rejects a global question that no competency references', () => {
    const pack = createPublishedPack({ questionIds: ['q-algorithmique', 'q-sql', 'q-orphan'] });

    expectCatalogError(() => validatePack(pack), 'PACK_INVALID_QUESTION_REFERENCES');
  });

  it('rejects cyclic competency prerequisites', () => {
    const pack = createPublishedPack({
      competencies: [
        { id: 'nsi.algorithmique', prerequisiteIds: ['nsi.sql'], questionIds: ['q-algorithmique'] },
        { id: 'nsi.sql', prerequisiteIds: ['nsi.algorithmique'], questionIds: ['q-sql'] },
      ],
    });

    expectCatalogError(() => validatePack(pack), 'PACK_INVALID_PREREQUISITE_GRAPH');
  });

  it('resolves a defensively copied fully reviewed published pack', () => {
    const pack = createPublishedPack();

    const resolved = resolveEligiblePack(selection, [pack]);
    resolved.competencies[0].id = 'mutated';

    expect(resolved).toMatchObject({ id: pack.id, status: 'PUBLISHED' });
    expect(resolveEligiblePack(selection, [pack]).competencies[0].id).toBe('nsi.algorithmique');
  });
});
