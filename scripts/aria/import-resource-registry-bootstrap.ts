/**
 * N4B CLI — the one-time Nexus-side bootstrap import of RAG's audited
 * resource identities into the canonical Resource Registry.
 *
 *   tsx scripts/aria/import-resource-registry-bootstrap.ts --inventory <path> [--dry-run|--apply] [--snapshot-out <path>]
 *
 * `--dry-run` (default) prints the diff and the would-be registry SHA
 * without writing anything. `--apply` writes `data/aria/resources.v2.json`
 * and, if `--snapshot-out` is given, the RAG-facing
 * `ResourceRegistrySnapshot` document RAG's own pipeline will verify against
 * (`ARIA_V1.md` §9, step 3).
 *
 * Deliberately NOT run against real production data by this session: no
 * real RAG bootstrap inventory export exists yet (RAG's new canonical
 * release is still blocked on its own currentness gate). This CLI is the
 * mechanism, ready the moment one does.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  applyResourceRegistryImport,
  assertNotHistoricalRelease,
  buildResourceRegistrySnapshot,
  computeResourceRegistryDiff,
  mapInventoryPlacements,
  validateBootstrapInventory,
  type AriaResourceRegistryDocument,
} from '../../lib/aria/n4b/import-resource-registry';
import { writeJsonFileAtomic } from './atomic-write-json';

const REGISTRY_PATH = 'data/aria/resources.v2.json';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function currentNexusCommit(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

interface Args {
  readonly inventoryPath: string;
  readonly apply: boolean;
  readonly snapshotOutPath: string | null;
}

function parseArgs(argv: readonly string[]): Args {
  const inventoryIndex = argv.indexOf('--inventory');
  const inventoryPath = inventoryIndex >= 0 ? argv[inventoryIndex + 1] : undefined;
  if (!inventoryPath) {
    throw new Error('ARIA_N4B_MISSING_ARGUMENT:--inventory <path> is required');
  }
  const snapshotIndex = argv.indexOf('--snapshot-out');
  const snapshotOutPath = snapshotIndex >= 0 ? (argv[snapshotIndex + 1] ?? null) : null;
  return {
    inventoryPath,
    apply: argv.includes('--apply'),
    snapshotOutPath,
  };
}

export function runN4bImport(input: {
  readonly repositoryRoot: string;
  readonly args: Args;
}): void {
  const registryPath = resolve(input.repositoryRoot, REGISTRY_PATH);
  const currentRegistry = readJson(registryPath) as AriaResourceRegistryDocument;
  const inventoryRaw = readJson(resolve(input.repositoryRoot, input.args.inventoryPath));

  const inventory = validateBootstrapInventory(inventoryRaw);
  assertNotHistoricalRelease(inventory);

  const { mapped, skipped, failures } = mapInventoryPlacements(inventory);
  if (failures.length > 0) {
    console.error(`ARIA_N4B_MAPPING_FAILED: ${failures.length} placement(s) could not be resolved:`);
    for (const failure of failures) {
      console.error(`  - ${failure.kind} on ${failure.resourceVersionId}: ${JSON.stringify(failure.placement)}`);
    }
    process.exitCode = 1;
    return;
  }

  const diff = computeResourceRegistryDiff(currentRegistry, mapped, inventory.generated_at);
  console.log(`ARIA_N4B_MAPPED_RESOURCES=${mapped.length}`);
  console.log(`ARIA_N4B_SKIPPED_RESOURCES=${skipped.length}`);
  for (const entry of skipped) {
    console.log(`  - SKIPPED ${entry.resourceVersionId}: ${entry.reason}`);
  }
  console.log(`ARIA_N4B_DIFF_ADDITIONS=${diff.additions.length}`);
  console.log(`ARIA_N4B_DIFF_ALREADY_PRESENT=${diff.alreadyPresent.length}`);
  console.log(`ARIA_N4B_DIFF_CONFLICTS=${diff.conflicts.length}`);

  if (diff.conflicts.length > 0) {
    console.error('ARIA_N4B_CONFLICTS:');
    for (const conflict of diff.conflicts) {
      console.error(`  - ${conflict.resourceId}: ${conflict.reason}`);
    }
    process.exitCode = 1;
    return;
  }

  const nextRegistry = applyResourceRegistryImport(currentRegistry, diff);

  if (!input.args.apply) {
    console.log('ARIA_N4B_MODE=DRY_RUN (pass --apply to write)');
    return;
  }

  writeJsonFileAtomic(registryPath, Buffer.from(`${JSON.stringify(nextRegistry, null, 2)}\n`, 'utf8'));
  console.log(`ARIA_N4B_MODE=APPLIED (${registryPath})`);

  if (input.args.snapshotOutPath) {
    const snapshot = buildResourceRegistrySnapshot({
      registry: nextRegistry,
      inventory,
      nexusProducerCommit: currentNexusCommit(),
      generatedAt: new Date().toISOString(),
    });
    const snapshotPath = resolve(input.repositoryRoot, input.args.snapshotOutPath);
    writeJsonFileAtomic(snapshotPath, Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`, 'utf8'));
    console.log(`ARIA_N4B_REGISTRY_SHA256=${snapshot.registry_sha256}`);
    console.log(`ARIA_N4B_SNAPSHOT_WRITTEN=${snapshotPath}`);
  }
}

if (require.main === module) {
  runN4bImport({
    repositoryRoot: resolve(process.cwd()),
    args: parseArgs(process.argv.slice(2)),
  });
}
