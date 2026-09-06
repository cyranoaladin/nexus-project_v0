import { migrateResourceRegistryV1ToV2 } from '@/scripts/aria/migrate-resource-registry-v1-to-v2';
import v1Registry from '@/data/aria/resources.v1.json';

describe('Resource Registry v1 → v2 migration', () => {
  const v2 = migrateResourceRegistryV1ToV2(v1Registry as never, {
    registryVersion: 'test-registry-version.1',
  }) as {
    readonly schemaVersion: string;
    readonly resources: readonly {
      readonly resourceId: string;
      readonly placements: readonly { readonly courseKey: string }[];
      readonly versions: readonly {
        readonly resourceVersionId: string;
        readonly contentSha256: string;
        readonly storage: { readonly provider: string; readonly relativePath?: string };
      }[];
    }[];
  };

  it('bumps schemaVersion to 2', () => {
    expect(v2.schemaVersion).toBe('2');
  });

  it('wraps each v1 courseKey into a single-element placements array', () => {
    for (let index = 0; index < v1Registry.resources.length; index += 1) {
      const before = v1Registry.resources[index]!;
      const after = v2.resources[index]!;
      expect(after.placements).toEqual([{ courseKey: before.courseKey }]);
    }
  });

  it('changes no resourceId, resourceVersionId, contentSha256, or storage path', () => {
    for (let index = 0; index < v1Registry.resources.length; index += 1) {
      const before = v1Registry.resources[index]!;
      const after = v2.resources[index]!;
      expect(after.resourceId).toBe(before.resourceId);
      expect(after.versions.map((version) => version.resourceVersionId)).toEqual(
        before.versions.map((version) => version.resourceVersionId),
      );
      expect(after.versions.map((version) => version.contentSha256)).toEqual(
        before.versions.map((version) => version.contentSha256),
      );
      expect(after.versions.map((version) => version.storage)).toEqual(
        before.versions.map((version) => version.storage),
      );
    }
  });

  it('does not introduce a courseKey field alongside placements', () => {
    for (const resource of v2.resources) {
      expect(resource).not.toHaveProperty('courseKey');
    }
  });

  it('preserves the resource count exactly', () => {
    expect(v2.resources).toHaveLength(v1Registry.resources.length);
  });
});
