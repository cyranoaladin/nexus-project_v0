import {
  ARIA_RESOURCE_REGISTRY_SHA256,
  ariaResourceRegistrySchema,
  getAriaResourceRecord,
  getAriaResourceVersion,
  isAriaResourceRagCitable,
  listActiveAriaResourceRecords,
  resolveAriaResourceProvenance,
  resolveLegacyAriaResourceAliasForMigration,
} from '@/lib/aria/manifests/resource-registry';
import registryDocument from '@/data/aria/resources.v2.json';
import registryJsonSchema from '@/data/aria/schemas/resource-registry-v2.schema.json';
import Ajv2019 from 'ajv/dist/2019';
import addFormats from 'ajv-formats';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;

describe('canonical ARIA Resource Registry', () => {
  it('matches its strict versioned machine-readable schema', () => {
    const ajv = new Ajv2019({ strict: true, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(registryJsonSchema);
    expect(validate(registryDocument)).toBe(true);
    expect(validate.errors).toBeNull();
    expect(validate({ ...registryDocument, unknownField: true })).toBe(false);
  });

  it('the machine-readable schema refuses duplicate placement courseKeys, matching the Zod contract', () => {
    const ajv = new Ajv2019({ strict: true, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(registryJsonSchema);
    const base = registryDocument.resources[2]!;
    const candidate = {
      ...registryDocument,
      resources: [{
        ...base,
        placements: [{ courseKey: 'eds-nsi-premiere' }, { courseKey: 'eds-nsi-premiere' }],
      }],
    };

    const ajvResult = validate(candidate);
    const zodResult = ariaResourceRegistrySchema.safeParse(candidate).success;

    expect(ajvResult).toBe(false);
    expect(zodResult).toBe(false);
  });

  it('owns one stable Resource and immutable ResourceVersion identity per artifact', () => {
    const active = listActiveAriaResourceRecords();
    expect(active).toHaveLength(3);
    expect(ARIA_RESOURCE_REGISTRY_SHA256).toMatch(SHA256);

    const resourceIds = new Set<string>();
    const versionIds = new Set<string>();
    for (const resource of active) {
      if (!resource.activeVersionId) throw new Error('active resource lacks activeVersionId');
      expect(resource.resourceId).toMatch(UUID);
      expect(resource.activeVersionId).toMatch(UUID);
      expect(resourceIds.has(resource.resourceId)).toBe(false);
      expect(versionIds.has(resource.activeVersionId)).toBe(false);
      resourceIds.add(resource.resourceId);
      versionIds.add(resource.activeVersionId);
      const version = getAriaResourceVersion(resource.resourceId, resource.activeVersionId);
      expect(version).toMatchObject({
        resourceVersionId: resource.activeVersionId,
        status: 'ACTIVE',
      });
      expect(version?.contentSha256).toMatch(SHA256);
    }
  });

  it('U038 does not expose a missing active ResourceVersion as current', () => {
    const obsoleteProgramme = resolveLegacyAriaResourceAliasForMigration(
      'res-maths-1ere-prog-bo',
    );
    const obsoleteAutomatismes = resolveLegacyAriaResourceAliasForMigration(
      'res-maths-1ere-automatismes-bo',
    );

    expect(getAriaResourceRecord(obsoleteProgramme?.resourceId ?? '')?.status).toBe('RETIRED');
    expect(getAriaResourceRecord(obsoleteAutomatismes?.resourceId ?? '')?.status).toBe('RETIRED');
    expect(listActiveAriaResourceRecords().some(
      (resource) => resource.placements.some((placement) => placement.courseKey === 'eds-maths-premiere'),
    )).toBe(false);
  });

  it('keeps legacy aliases migration-only and requires authoritative provenance', () => {
    const legacy = resolveLegacyAriaResourceAliasForMigration('res-maths-tle-prog-bo');
    expect(legacy?.resourceId).toMatch(UUID);
    const record = getAriaResourceRecord(legacy?.resourceId ?? '');
    expect(record).toMatchObject({
      placements: [{ courseKey: 'eds-maths-terminale' }],
      visibility: 'PUBLIC',
      ownerStudentId: null,
      source: {
        official: true,
        rights: 'OFFICIAL_PUBLIC',
      },
    });
    expect(record?.source.uri).toMatch(/^https:\/\/(?:www\.)?(?:education\.gouv\.fr|eduscol\.education\.gouv\.fr)\//);
  });

  it('derives truthful provenance from the complete source-rights contract', () => {
    expect(resolveAriaResourceProvenance({ official: true, rights: 'OFFICIAL_PUBLIC' }))
      .toBe('OFFICIEL_MEN');
    expect(resolveAriaResourceProvenance({ official: false, rights: 'NEXUS_PROPRIETARY' }))
      .toBe('NEXUS_METHODE');
    expect(resolveAriaResourceProvenance({ official: false, rights: 'STUDENT_PRIVATE' }))
      .toBe('STUDENT_PROVIDED');
    expect(() => resolveAriaResourceProvenance({ official: true, rights: 'STUDENT_PRIVATE' }))
      .toThrow('ARIA_RESOURCE_SOURCE_CONTRACT_INVALID');
  });

  it('allows only public registry resources into the shared RAG corpus', () => {
    expect(isAriaResourceRagCitable('PUBLIC')).toBe(true);
    expect(isAriaResourceRagCitable('STUDENT_PRIVATE')).toBe(false);
    expect(isAriaResourceRagCitable('COACH_VISIBLE')).toBe(false);
    expect(isAriaResourceRagCitable('PARENT_VISIBLE')).toBe(false);
    expect(isAriaResourceRagCitable('SYSTEM_ONLY')).toBe(false);
  });

  it('rejects contradictory official and student-private source declarations', () => {
    const base = registryDocument.resources[2]!;
    expect(ariaResourceRegistrySchema.safeParse({
      ...registryDocument,
      resources: [{
        ...base,
        source: { ...base.source, official: false, rights: 'OFFICIAL_PUBLIC' },
      }],
    }).success).toBe(false);
    expect(ariaResourceRegistrySchema.safeParse({
      ...registryDocument,
      resources: [{
        ...base,
        visibility: 'STUDENT_PRIVATE',
        ownerStudentId: 'student-1',
        source: { ...base.source, official: false, rights: 'NEXUS_PROPRIETARY' },
      }],
    }).success).toBe(false);
  });

  it('rejects two immutable ResourceVersions that point at the same storage artifact', () => {
    const first = registryDocument.resources[0]!;
    const second = registryDocument.resources[1]!;
    expect(ariaResourceRegistrySchema.safeParse({
      ...registryDocument,
      resources: [
        first,
        {
          ...second,
          versions: [{
            ...second.versions[0]!,
            storage: { ...first.versions[0]!.storage },
          }],
        },
      ],
    }).success).toBe(false);
  });

  it('rejects a resource with zero placements', () => {
    const base = registryDocument.resources[2]!;
    expect(ariaResourceRegistrySchema.safeParse({
      ...registryDocument,
      resources: [{ ...base, placements: [] }],
    }).success).toBe(false);
  });

  it('rejects a resource with a duplicate placement', () => {
    const base = registryDocument.resources[2]!;
    expect(ariaResourceRegistrySchema.safeParse({
      ...registryDocument,
      resources: [{ ...base, placements: [{ courseKey: 'eds-maths-terminale' }, { courseKey: 'eds-maths-terminale' }] }],
    }).success).toBe(false);
  });

  it('rejects placements that are not canonically sorted by courseKey', () => {
    const base = registryDocument.resources[2]!;
    expect(ariaResourceRegistrySchema.safeParse({
      ...registryDocument,
      resources: [{
        ...base,
        placements: [{ courseKey: 'eds-nsi-terminale' }, { courseKey: 'eds-maths-terminale' }],
      }],
    }).success).toBe(false);
  });

  it('accepts a canonical resource shared across two placements, in sorted order', () => {
    const base = registryDocument.resources[2]!;
    const result = ariaResourceRegistrySchema.safeParse({
      ...registryDocument,
      resources: [{
        ...base,
        placements: [{ courseKey: 'eds-maths-terminale' }, { courseKey: 'eds-nsi-terminale' }],
      }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a placement whose courseKey is not a known curriculum course', () => {
    const base = registryDocument.resources[2]!;
    expect(ariaResourceRegistrySchema.safeParse({
      ...registryDocument,
      resources: [{ ...base, placements: [{ courseKey: 'course-that-does-not-exist' }] }],
    }).success).toBe(false);
  });

  it('rejects an unknown storage provider', () => {
    const base = registryDocument.resources[2]!;
    expect(ariaResourceRegistrySchema.safeParse({
      ...registryDocument,
      resources: [{
        ...base,
        versions: [{ ...base.versions[0]!, storage: { provider: 'SOME_OTHER_PROVIDER' } }],
      }],
    }).success).toBe(false);
  });

  it('rejects a RAG_GOVERNED storage entry carrying a fake local relativePath', () => {
    const base = registryDocument.resources[2]!;
    expect(ariaResourceRegistrySchema.safeParse({
      ...registryDocument,
      resources: [{
        ...base,
        versions: [{
          ...base.versions[0]!,
          storage: { provider: 'RAG_GOVERNED', relativePath: 'not-allowed.pdf' },
        }],
      }],
    }).success).toBe(false);
  });

  it('accepts a RAG_GOVERNED ResourceVersion with no local path at all', () => {
    const base = registryDocument.resources[2]!;
    const result = ariaResourceRegistrySchema.safeParse({
      ...registryDocument,
      resources: [{
        ...base,
        versions: [{ ...base.versions[0]!, storage: { provider: 'RAG_GOVERNED' } }],
      }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an absolute local storage path', () => {
    const base = registryDocument.resources[2]!;
    expect(ariaResourceRegistrySchema.safeParse({
      ...registryDocument,
      resources: [{
        ...base,
        versions: [{
          ...base.versions[0]!,
          storage: { provider: 'NEXUS_REPOSITORY', relativePath: '/etc/passwd' },
        }],
      }],
    }).success).toBe(false);
  });

  it('rejects a local storage path with a directory-traversal segment', () => {
    const base = registryDocument.resources[2]!;
    expect(ariaResourceRegistrySchema.safeParse({
      ...registryDocument,
      resources: [{
        ...base,
        versions: [{
          ...base.versions[0]!,
          storage: { provider: 'NEXUS_REPOSITORY', relativePath: '../outside.pdf' },
        }],
      }],
    }).success).toBe(false);
  });

  it('rejects the same resourceId declared twice as separate top-level resources', () => {
    // The identity-duplication failure mode a single-canonical-course model
    // would have forced: a resource shared by two courses declared TWICE
    // under the same resourceId, rather than once with two placements.
    const base = registryDocument.resources[2]!;
    expect(ariaResourceRegistrySchema.safeParse({
      ...registryDocument,
      resources: [
        base,
        { ...base, placements: [{ courseKey: 'eds-nsi-premiere' }] },
      ],
    }).success).toBe(false);
  });
});
