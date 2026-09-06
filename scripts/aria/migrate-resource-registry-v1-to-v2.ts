/**
 * Deterministic v1 → v2 Resource Registry transform.
 *
 * v2 replaces the one-canonical-course assumption (`courseKey: string`) with
 * `placements: [{courseKey}]`, and makes `storage` an explicit discriminated
 * union so a RAG-governed resource never has to fabricate a local path. This
 * transform touches ONLY that shape: no resourceId, resourceVersionId,
 * contentSha256, or storage path is ever changed, added, or removed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeJsonFileAtomic } from './atomic-write-json';

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

/**
 * This migration is a ONE-TIME transform of the frozen v1 snapshot — it is
 * never the right tool to regenerate a v2 registry that has since gained
 * real post-migration data (a genuine multi-placement resource, a
 * RAG_GOVERNED entry). Running it again would silently discard all of that
 * by overwriting with a fresh derivation from the still-frozen v1 file.
 * Kept checked-in and runnable only as historical migration evidence
 * (`data/aria/resources.v1.json`'s own doc comment) — never re-run to
 * "refresh" v2, hence the hard refusal when the destination already exists.
 */
export function runResourceRegistryV1ToV2Migration(input: {
  readonly repositoryRoot: string;
  readonly write?: (value: string) => void;
}): void {
  const sourcePath = resolve(input.repositoryRoot, 'data/aria/resources.v1.json');
  const destinationPath = resolve(input.repositoryRoot, 'data/aria/resources.v2.json');
  if (existsSync(destinationPath)) {
    throw new Error(`ARIA_RESOURCE_REGISTRY_V2_ALREADY_EXISTS:${destinationPath}`);
  }
  const v1 = JSON.parse(readFileSync(sourcePath, 'utf8')) as V1Registry;
  const v2 = migrateResourceRegistryV1ToV2(v1, {
    registryVersion: 'aria-resource-registry-2026-09-06.1',
  });
  writeJsonFileAtomic(destinationPath, Buffer.from(`${JSON.stringify(v2, null, 2)}\n`, 'utf8'));
  (input.write ?? ((value: string) => process.stdout.write(value)))(
    `ARIA_RESOURCE_REGISTRY_V2_WRITTEN=${destinationPath}\n`,
  );
}

if (require.main === module) {
  runResourceRegistryV1ToV2Migration({ repositoryRoot: resolve(process.cwd()) });
}
