/**
 * Defensive-branch proofs for `lib/aria/resources.ts` that the shared-fixture
 * multi-placement suite cannot exercise without breaking its own module-load
 * invariant: each scenario here needs its OWN isolated module registry with a
 * deliberately inconsistent registry, so `jest.isolateModules` + `jest.doMock`
 * per test instead of one shared top-level `jest.mock`.
 */

const GOOD_RESOURCE_ID = '77777777-7777-4777-8777-777777777777';
const GOOD_VERSION_ID = '88888888-8888-4888-8888-888888888888';

function goodVersion(id: string) {
  return {
    resourceVersionId: id,
    status: 'ACTIVE' as const,
    contentSha256: 'a'.repeat(64),
    sizeBytes: 42,
    mimeType: 'application/pdf' as const,
    storage: { provider: 'NEXUS_REPOSITORY' as const, relativePath: `${id}.pdf` },
  };
}

const goodRecord = {
  resourceId: GOOD_RESOURCE_ID,
  legacyAliases: [],
  placements: [{ courseKey: 'eds-nsi-premiere' }],
  title: 'Ressource valide',
  description: 'Fixture de contrôle',
  type: 'PDF' as const,
  status: 'ACTIVE' as const,
  activeVersionId: GOOD_VERSION_ID,
  visibility: 'PUBLIC' as const,
  ownerStudentId: null,
  source: {
    label: 'Ministère de l’Éducation nationale',
    uri: 'https://www.education.gouv.fr/fixture',
    reference: 'fixture',
    official: true,
    rights: 'OFFICIAL_PUBLIC' as const,
  },
  versions: [goodVersion(GOOD_VERSION_ID)],
};

afterEach(() => {
  jest.dontMock('@/lib/aria/manifests/resource-registry');
  jest.dontMock('@/lib/aria/infrastructure/resources/secure-open-linux');
});

describe('lib/aria/resources — defensive data-integrity branches', () => {
  it('returns null (never throws) when a resource record is active but its active version cannot be resolved', () => {
    const MISSING_VERSION_RESOURCE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const malformedRecord = {
      ...goodRecord,
      resourceId: MISSING_VERSION_RESOURCE_ID,
      activeVersionId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      versions: [], // the referenced active version simply does not exist
    };
    const records = [goodRecord, malformedRecord];

    jest.doMock('@/lib/aria/manifests/resource-registry', () => ({
      // Excluded from the active list: a real production listActiveAriaResourceRecords
      // would never surface a record whose own active version is unresolvable.
      // This mock's exclusion mirrors that so module load stays valid, while the
      // pointwise lookups below still expose the inconsistency for the defensive check.
      listActiveAriaResourceRecords: () => [goodRecord],
      listAriaResourceRecords: () => records,
      getAriaResourceRecord: (id: string) => records.find((r) => r.resourceId === id) ?? null,
      getAriaResourceVersion: (resourceId: string, versionId: string) =>
        records.find((r) => r.resourceId === resourceId)
          ?.versions.find((v) => v.resourceVersionId === versionId) ?? null,
      resolveAriaResourceProvenance: () => 'OFFICIEL_MEN',
    }));

    jest.isolateModules(() => {
      const { getResourceForCourse, getActiveResourcePlacements } =
        require('@/lib/aria/resources') as typeof import('@/lib/aria/resources');
      expect(getResourceForCourse(MISSING_VERSION_RESOURCE_ID, 'eds-nsi-premiere')).toBeNull();
      expect(getActiveResourcePlacements(MISSING_VERSION_RESOURCE_ID)).toBeNull();
    });
  });

  it('returns null when a resource record is active but its active version is not itself ACTIVE', () => {
    const RETIRED_VERSION_RESOURCE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const retiredVersionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const malformedRecord = {
      ...goodRecord,
      resourceId: RETIRED_VERSION_RESOURCE_ID,
      activeVersionId: retiredVersionId,
      versions: [{ ...goodVersion(retiredVersionId), status: 'RETIRED' as const }],
    };
    const records = [goodRecord, malformedRecord];

    jest.doMock('@/lib/aria/manifests/resource-registry', () => ({
      listActiveAriaResourceRecords: () => [goodRecord],
      listAriaResourceRecords: () => records,
      getAriaResourceRecord: (id: string) => records.find((r) => r.resourceId === id) ?? null,
      getAriaResourceVersion: (resourceId: string, versionId: string) =>
        records.find((r) => r.resourceId === resourceId)
          ?.versions.find((v) => v.resourceVersionId === versionId) ?? null,
      resolveAriaResourceProvenance: () => 'OFFICIEL_MEN',
    }));

    jest.isolateModules(() => {
      const { getResourceForCourse } =
        require('@/lib/aria/resources') as typeof import('@/lib/aria/resources');
      expect(getResourceForCourse(RETIRED_VERSION_RESOURCE_ID, 'eds-nsi-premiere')).toBeNull();
    });
  });

  it('refuses to start when the active registry itself contains an unresolvable active version', () => {
    const BROKEN_RESOURCE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const brokenRecord = {
      ...goodRecord,
      resourceId: BROKEN_RESOURCE_ID,
      activeVersionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      versions: [], // module load must never silently paper over this
    };
    const records = [goodRecord, brokenRecord];

    jest.doMock('@/lib/aria/manifests/resource-registry', () => ({
      // Deliberately inconsistent: the active list includes a record whose own
      // active version cannot be resolved — proves the module-load guard fails
      // loudly instead of building a corrupted projection.
      listActiveAriaResourceRecords: () => records,
      listAriaResourceRecords: () => records,
      getAriaResourceRecord: (id: string) => records.find((r) => r.resourceId === id) ?? null,
      getAriaResourceVersion: (resourceId: string, versionId: string) =>
        records.find((r) => r.resourceId === resourceId)
          ?.versions.find((v) => v.resourceVersionId === versionId) ?? null,
      resolveAriaResourceProvenance: () => 'OFFICIEL_MEN',
    }));

    expect(() => {
      jest.isolateModules(() => {
        require('@/lib/aria/resources');
      });
    }).toThrow('ARIA active resource projection is invalid');
  });

  it('assertLocalResourceArtifactsIntegrity verifies local artifacts but never opens a RAG_GOVERNED version', async () => {
    const RAG_ID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
    const RAG_VERSION_ID = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';
    const ragRecord = {
      ...goodRecord,
      resourceId: RAG_ID,
      title: 'Ressource gouvernée par RAG',
      activeVersionId: RAG_VERSION_ID,
      versions: [{
        resourceVersionId: RAG_VERSION_ID,
        status: 'ACTIVE' as const,
        contentSha256: 'b'.repeat(64),
        sizeBytes: 42,
        mimeType: 'application/pdf' as const,
        storage: { provider: 'RAG_GOVERNED' as const },
      }],
    };
    const records = [goodRecord, ragRecord];
    const openVerifiedAriaResourceFile = jest.fn().mockResolvedValue({ close: jest.fn().mockResolvedValue(undefined) });

    jest.doMock('@/lib/aria/manifests/resource-registry', () => ({
      listActiveAriaResourceRecords: () => records,
      listAriaResourceRecords: () => records,
      getAriaResourceRecord: (id: string) => records.find((r) => r.resourceId === id) ?? null,
      getAriaResourceVersion: (resourceId: string, versionId: string) =>
        records.find((r) => r.resourceId === resourceId)
          ?.versions.find((v) => v.resourceVersionId === versionId) ?? null,
      resolveAriaResourceProvenance: () => 'OFFICIEL_MEN',
    }));
    jest.doMock('@/lib/aria/infrastructure/resources/secure-open-linux', () => ({
      openVerifiedAriaResourceFile,
    }));

    await jest.isolateModules(async () => {
      const { assertLocalResourceArtifactsIntegrity } =
        require('@/lib/aria/resources') as typeof import('@/lib/aria/resources');
      await expect(assertLocalResourceArtifactsIntegrity('/tmp/does-not-matter')).resolves.toBeUndefined();
    });

    expect(openVerifiedAriaResourceFile).toHaveBeenCalledTimes(1);
    expect(openVerifiedAriaResourceFile).toHaveBeenCalledWith(expect.objectContaining({
      relativePath: `${GOOD_VERSION_ID}.pdf`,
    }));
  });
});
