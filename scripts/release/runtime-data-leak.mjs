/**
 * runtime-data-leak.mjs — Detect real runtime data bundled into a build artifact.
 *
 * Next.js output-file-tracing copies whatever a `process.cwd()` fallback points
 * at. Application code resolves document and invoice storage that way
 * (`lib/documents/storage-root.ts`, `lib/invoice/storage.ts`), so when a
 * developer machine happens to hold local files under `storage/documents` or
 * `data/invoices`, the build sweeps them into `.next/standalone/` and the
 * deploy rsyncs them to a release directory on the production server.
 *
 * This happened three times. `.gitignore` does not prevent it: tracing copies
 * from the working tree, not from git. Only a blocking pre-transfer check does.
 *
 * Real customer invoices carry a name and a postal address, so a leak here is a
 * personal-data incident, not merely untidy packaging.
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/**
 * Directories that must never contain files inside a build artifact. Relative
 * to the artifact root; each is checked both at the root and inside
 * `.next/standalone/`, which is what actually ships.
 */
const RUNTIME_DATA_DIRECTORIES = Object.freeze([
  join('storage', 'documents'),
  join('storage', 'invoices'),
  join('data', 'invoices'),
  join('uploads'),
]);

const ARTIFACT_PREFIXES = Object.freeze(['', join('.next', 'standalone')]);

function listFilesRecursively(directory) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Returns artifact-relative paths of every runtime data file found.
 * An empty array means the artifact is clean.
 *
 * @param {string} artifactRoot
 * @returns {string[]}
 */
export function findRuntimeDataLeaks(artifactRoot) {
  const root = resolve(artifactRoot);
  const leaks = [];

  for (const prefix of ARTIFACT_PREFIXES) {
    for (const runtimeDirectory of RUNTIME_DATA_DIRECTORIES) {
      const candidate = join(root, prefix, runtimeDirectory);
      let stats;
      try {
        stats = statSync(candidate);
      } catch {
        continue;
      }
      if (!stats.isDirectory()) continue;
      for (const file of listFilesRecursively(candidate)) {
        leaks.push(relative(root, file).split(sep).join('/'));
      }
    }
  }

  return leaks.sort();
}

export { RUNTIME_DATA_DIRECTORIES };
