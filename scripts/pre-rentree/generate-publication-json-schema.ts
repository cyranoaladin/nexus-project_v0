#!/usr/bin/env tsx

import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { zodToJsonSchema } from 'zod-to-json-schema';

import { PublicationSnapshotSchema } from './publication-snapshot-schema';


export function publicationJsonSchema() {
  const schema = zodToJsonSchema(PublicationSnapshotSchema, {
    name: 'PublicationSnapshot',
    target: 'jsonSchema2019-09',
    effectStrategy: 'input',
    removeAdditionalStrategy: 'passthrough',
    $refStrategy: 'root',
  });
  return {
    ...schema,
    $id: 'https://nexusreussite.academy/schemas/pre-rentree-2026-publication.snapshot.schema.json',
    title: 'Nexus Réussite Pré-rentrée 2026 publication snapshot',
  };
}

export function writeJsonAtomic(outputPath: string, value: unknown) {
  const absoluteOutput = resolve(outputPath);
  mkdirSync(dirname(absoluteOutput), { recursive: true });
  const temporaryPath = `${absoluteOutput}.tmp-${process.pid}`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 });
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
  const output = argument('--output');
  writeJsonAtomic(output, publicationJsonSchema());
  process.stdout.write(`${resolve(output)}\n`);
}

if (require.main === module) main();
