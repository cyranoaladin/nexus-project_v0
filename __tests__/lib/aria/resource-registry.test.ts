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
import registryDocument from '@/data/aria/resources.v1.json';
import registryJsonSchema from '@/data/aria/schemas/resource-registry-v1.schema.json';
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
      (resource) => resource.courseKey === 'eds-maths-premiere',
    )).toBe(false);
  });

  it('keeps legacy aliases migration-only and requires authoritative provenance', () => {
    const legacy = resolveLegacyAriaResourceAliasForMigration('res-maths-tle-prog-bo');
    expect(legacy?.resourceId).toMatch(UUID);
    const record = getAriaResourceRecord(legacy?.resourceId ?? '');
    expect(record).toMatchObject({
      courseKey: 'eds-maths-terminale',
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
});
