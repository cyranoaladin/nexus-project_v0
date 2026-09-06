/**
 * Multi-placement course-leakage guard (Nexus Resource Registry v2).
 *
 * `resources.ts` builds its course index ONCE, from the real registry, at
 * module load — no real resource is multi-placement today. This test
 * substitutes a synthetic two-placement record so the guard can be proven
 * without touching production registry data.
 */

const SHARED_RESOURCE_ID = '11111111-1111-4111-8111-111111111111';
const SHARED_VERSION_ID = '22222222-2222-4222-8222-222222222222';
const SOLO_RESOURCE_ID = '33333333-3333-4333-8333-333333333333';
const SOLO_VERSION_ID = '44444444-4444-4444-8444-444444444444';

function version(id: string) {
  return {
    resourceVersionId: id,
    status: 'ACTIVE' as const,
    contentSha256: 'a'.repeat(64),
    sizeBytes: 42,
    mimeType: 'application/pdf' as const,
    storage: { provider: 'NEXUS_REPOSITORY' as const, relativePath: `${id}.pdf` },
  };
}

const sharedRecord = {
  resourceId: SHARED_RESOURCE_ID,
  legacyAliases: [],
  placements: [{ courseKey: 'eds-nsi-premiere' }, { courseKey: 'eds-nsi-terminale' }],
  title: 'Ressource partagée NSI',
  description: 'Ressource commune Première et Terminale',
  type: 'PDF' as const,
  status: 'ACTIVE' as const,
  activeVersionId: SHARED_VERSION_ID,
  visibility: 'PUBLIC' as const,
  ownerStudentId: null,
  source: {
    label: 'Ministère de l’Éducation nationale',
    uri: 'https://www.education.gouv.fr/fixture',
    reference: 'fixture',
    official: true,
    rights: 'OFFICIAL_PUBLIC' as const,
  },
  versions: [version(SHARED_VERSION_ID)],
};

const soloRecord = {
  ...sharedRecord,
  resourceId: SOLO_RESOURCE_ID,
  placements: [{ courseKey: 'eds-nsi-premiere' }],
  activeVersionId: SOLO_VERSION_ID,
  versions: [version(SOLO_VERSION_ID)],
};

const RAG_GOVERNED_RESOURCE_ID = '55555555-5555-4555-8555-555555555555';
const RAG_GOVERNED_VERSION_ID = '66666666-6666-4666-8666-666666666666';

const ragGovernedRecord = {
  ...sharedRecord,
  resourceId: RAG_GOVERNED_RESOURCE_ID,
  placements: [{ courseKey: 'eds-nsi-premiere' }],
  title: 'Ressource gouvernée par RAG',
  description: 'Aucun fichier local — la lignée RAG en est la seule autorité',
  activeVersionId: RAG_GOVERNED_VERSION_ID,
  versions: [{
    resourceVersionId: RAG_GOVERNED_VERSION_ID,
    status: 'ACTIVE' as const,
    contentSha256: 'b'.repeat(64),
    sizeBytes: 42,
    mimeType: 'application/pdf' as const,
    storage: { provider: 'RAG_GOVERNED' as const },
  }],
};

const records = [sharedRecord, soloRecord, ragGovernedRecord];

jest.mock('@/lib/aria/manifests/resource-registry', () => ({
  listAriaResourceRecords: () => records,
  listActiveAriaResourceRecords: () => records,
  getAriaResourceRecord: (id: string) => records.find((record) => record.resourceId === id) ?? null,
  getAriaResourceVersion: (resourceId: string, versionId: string) =>
    records.find((record) => record.resourceId === resourceId)
      ?.versions.find((v) => v.resourceVersionId === versionId) ?? null,
  resolveAriaResourceProvenance: () => 'OFFICIEL_MEN',
}));

describe('Nexus Resource Registry v2 — multi-placement course leakage guard', () => {
  it('a resource shared by two courses is visible in both, with the same canonical identity', () => {
    const { listResourcesForCourse } = require('@/lib/aria/resources') as typeof import('@/lib/aria/resources');
    const premiere = listResourcesForCourse('eds-nsi-premiere').find((r) => r.id === SHARED_RESOURCE_ID);
    const terminale = listResourcesForCourse('eds-nsi-terminale').find((r) => r.id === SHARED_RESOURCE_ID);
    expect(premiere).toBeDefined();
    expect(terminale).toBeDefined();
    expect(premiere!.resourceVersionId).toBe(terminale!.resourceVersionId);
    expect(premiere!.contentSha256).toBe(terminale!.contentSha256);
    expect(premiere!.courseKey).toBe('eds-nsi-premiere');
    expect(terminale!.courseKey).toBe('eds-nsi-terminale');
  });

  it('a resource placed only in one course never appears in another', () => {
    const { listResourcesForCourse } = require('@/lib/aria/resources') as typeof import('@/lib/aria/resources');
    expect(listResourcesForCourse('eds-nsi-premiere').some((r) => r.id === SOLO_RESOURCE_ID)).toBe(true);
    expect(listResourcesForCourse('eds-nsi-terminale').some((r) => r.id === SOLO_RESOURCE_ID)).toBe(false);
  });

  it('an unknown course lists no resources', () => {
    const { listResourcesForCourse } = require('@/lib/aria/resources') as typeof import('@/lib/aria/resources');
    expect(listResourcesForCourse('course-that-does-not-exist')).toEqual([]);
  });

  it('getResource refuses ambiguity for a multi-placement resource instead of guessing placements[0]', () => {
    const { getResource } = require('@/lib/aria/resources') as typeof import('@/lib/aria/resources');
    expect(() => getResource(SHARED_RESOURCE_ID)).toThrow(
      expect.objectContaining({ code: 'RESOURCE_COURSE_CONTEXT_REQUIRED' }),
    );
  });

  it('getResource still resolves a single-placement resource directly', () => {
    const { getResource } = require('@/lib/aria/resources') as typeof import('@/lib/aria/resources');
    const resource = getResource(SOLO_RESOURCE_ID);
    expect(resource?.courseKey).toBe('eds-nsi-premiere');
  });
});

describe('Nexus Resource Registry v2 — RAG-governed storage never fabricates a local file', () => {
  it('projects filename as undefined for a RAG_GOVERNED ResourceVersion — never an empty string', () => {
    const { getResource } = require('@/lib/aria/resources') as typeof import('@/lib/aria/resources');
    const resource = getResource(RAG_GOVERNED_RESOURCE_ID);
    expect(resource).not.toBeNull();
    expect(resource!.filename).toBeUndefined();
    expect(resource!.contentSha256).toBe('b'.repeat(64));
  });
});
