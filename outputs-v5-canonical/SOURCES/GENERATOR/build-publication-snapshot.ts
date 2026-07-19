#!/usr/bin/env tsx

import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { compileCanonicalPublication } from './publication-sources';
import type { PublicationSnapshot } from './publication-snapshot-schema';

export function compilePublicationSnapshot(options: {
  repoRoot: string;
  sourceRepoSha: string;
}): PublicationSnapshot {
  return compileCanonicalPublication(options);
}

export function writeSnapshotAtomic(snapshot: PublicationSnapshot, outputPath: string) {
  const absoluteOutput = resolve(outputPath);
  mkdirSync(dirname(absoluteOutput), { recursive: true });
  const temporaryPath = `${absoluteOutput}.tmp-${process.pid}`;
  writeFileSync(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 });
  const descriptor = openSync(temporaryPath, 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporaryPath, absoluteOutput);
}

function argument(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing required argument: ${name}`);
  return process.argv[index + 1];
}

export function main() {
  const repoRoot = argument('--repo-root');
  const sourceRepoSha = argument('--source-repo-sha');
  const output = argument('--output');
  const snapshot = compilePublicationSnapshot({ repoRoot, sourceRepoSha });
  writeSnapshotAtomic(snapshot, output);
  process.stdout.write(`${resolve(output)}\n`);
}

if (require.main === module) {
  main();
}
