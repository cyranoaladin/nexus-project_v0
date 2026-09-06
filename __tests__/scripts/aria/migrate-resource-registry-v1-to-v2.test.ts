import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  migrateResourceRegistryV1ToV2,
  runResourceRegistryV1ToV2Migration,
} from '@/scripts/aria/migrate-resource-registry-v1-to-v2';
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

describe('runResourceRegistryV1ToV2Migration — the checked-in one-time CLI', () => {
  function fixtureRoot(): string {
    const root = mkdtempSync(join(tmpdir(), 'aria-migrate-v2-'));
    mkdirSync(join(root, 'data/aria'), { recursive: true });
    writeFileSync(join(root, 'data/aria/resources.v1.json'), JSON.stringify(v1Registry));
    return root;
  }

  it('writes the migrated v2 registry when no destination exists yet', () => {
    const root = fixtureRoot();
    const output: string[] = [];
    runResourceRegistryV1ToV2Migration({ repositoryRoot: root, write: (v) => output.push(v) });
    const written = JSON.parse(readFileSync(join(root, 'data/aria/resources.v2.json'), 'utf8'));
    expect(written.schemaVersion).toBe('2');
    expect(output.join('')).toContain('ARIA_RESOURCE_REGISTRY_V2_WRITTEN=');
  });

  it('refuses to overwrite an existing v2 registry, never silently discarding post-migration data', () => {
    const root = fixtureRoot();
    writeFileSync(join(root, 'data/aria/resources.v2.json'), '{"schemaVersion":"2","resources":["post-migration-data"]}\n');
    expect(() => runResourceRegistryV1ToV2Migration({ repositoryRoot: root }))
      .toThrow('ARIA_RESOURCE_REGISTRY_V2_ALREADY_EXISTS');
    expect(readFileSync(join(root, 'data/aria/resources.v2.json'), 'utf8'))
      .toBe('{"schemaVersion":"2","resources":["post-migration-data"]}\n');
  });
});
