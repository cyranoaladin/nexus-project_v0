/**
 * Deterministic v1 → v2 Resource Registry transform.
 *
 * v2 replaces the one-canonical-course assumption (`courseKey: string`) with
 * `placements: [{courseKey}]`, and makes `storage` an explicit discriminated
 * union so a RAG-governed resource never has to fabricate a local path. This
 * transform touches ONLY that shape: no resourceId, resourceVersionId,
 * contentSha256, or storage path is ever changed, added, or removed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface V1Resource {
  readonly courseKey: string;
  readonly [key: string]: unknown;
}

interface V1Registry {
  readonly schemaVersion: '1';
  readonly registryVersion: string;
  readonly idNamespace: string;
  readonly resources: readonly V1Resource[];
}

export function migrateResourceRegistryV1ToV2(
  v1: V1Registry,
  input: { readonly registryVersion: string },
): Record<string, unknown> {
  return {
    schemaVersion: '2',
    registryVersion: input.registryVersion,
    idNamespace: v1.idNamespace,
    resources: v1.resources.map((resource) => {
      const { courseKey, ...rest } = resource;
      return { ...rest, placements: [{ courseKey }] };
    }),
  };
}

function main(): void {
  const repositoryRoot = resolve(process.cwd());
  const sourcePath = resolve(repositoryRoot, 'data/aria/resources.v1.json');
  const destinationPath = resolve(repositoryRoot, 'data/aria/resources.v2.json');
  const v1 = JSON.parse(readFileSync(sourcePath, 'utf8')) as V1Registry;
  const v2 = migrateResourceRegistryV1ToV2(v1, {
    registryVersion: 'aria-resource-registry-2026-09-06.1',
  });
  writeFileSync(destinationPath, `${JSON.stringify(v2, null, 2)}\n`, { mode: 0o644 });
  process.stdout.write(`ARIA_RESOURCE_REGISTRY_V2_WRITTEN=${destinationPath}\n`);
}

if (require.main === module) {
  main();
}
