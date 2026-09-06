import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { ariaResourceRegistrySchema } from '../../lib/aria/manifests/resource-registry';

const OUTPUT_PATH = 'data/aria/schemas/resource-registry-v2.schema.json';

function schemaBytes(): Buffer {
  const schema = zodToJsonSchema(ariaResourceRegistrySchema, {
    name: 'AriaResourceRegistryV2',
    target: 'jsonSchema2019-09',
    effectStrategy: 'input',
    $refStrategy: 'root',
  });
  return Buffer.from(`${JSON.stringify({
    ...schema,
    $id: 'https://nexusreussite.academy/schemas/aria/resource-registry-v2.schema.json',
    title: 'ARIA canonical Resource Registry v2',
  }, null, 2)}\n`, 'utf8');
}

function writeAtomic(path: string, bytes: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, bytes, { mode: 0o644 });
  const descriptor = openSync(temporary, 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, path);
}

export function exportAriaResourceRegistrySchema(input: {
  readonly repositoryRoot: string;
  readonly check: boolean;
}): void {
  const output = join(input.repositoryRoot, OUTPUT_PATH);
  const expected = schemaBytes();
  if (input.check) {
    let actual: Buffer;
    try {
      actual = readFileSync(output);
    } catch {
      throw new Error(`ARIA_RESOURCE_REGISTRY_SCHEMA_MISSING:${output}`);
    }
    if (!actual.equals(expected)) throw new Error(`ARIA_RESOURCE_REGISTRY_SCHEMA_DRIFT:${output}`);
    return;
  }
  writeAtomic(output, expected);
}

if (require.main === module) {
  exportAriaResourceRegistrySchema({
    repositoryRoot: resolve(process.cwd()),
    check: process.argv.includes('--check'),
  });
}
