import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { listCourseKeys } from '../../lib/curriculum/catalog';
import { ariaResourceRegistrySchema } from '../../lib/aria/manifests/resource-registry';
import { writeJsonFileAtomic } from './atomic-write-json';

const OUTPUT_PATH = 'data/aria/schemas/resource-registry-v2.schema.json';

interface JsonSchemaNode {
  [key: string]: unknown;
}

/**
 * `zod-to-json-schema` has no equivalent of the imperative `superRefine`
 * uniqueness check `resourceSchema` runs at parse time — it emits `minItems`
 * only. Patching the exact known node (not a generic deep search, which
 * could silently touch an unrelated array) keeps the machine-readable
 * contract honest with the documented ">=1, unique" placements invariant.
 * Fails loud if the generator's shape ever drifts from what this expects.
 */
function requirePlacementsArrayNode(schema: JsonSchemaNode): JsonSchemaNode {
  const definitions = schema.definitions as JsonSchemaNode | undefined;
  const registry = definitions?.AriaResourceRegistryV2 as JsonSchemaNode | undefined;
  const resourceItems = (registry?.properties as JsonSchemaNode | undefined)
    ?.resources as JsonSchemaNode | undefined;
  const resourceItem = resourceItems?.items as JsonSchemaNode | undefined;
  const placements = (resourceItem?.properties as JsonSchemaNode | undefined)
    ?.placements as JsonSchemaNode | undefined;
  if (!placements || placements.type !== 'array') {
    throw new Error('ARIA_RESOURCE_REGISTRY_SCHEMA_PLACEMENTS_NODE_MISSING');
  }
  return placements;
}

/**
 * Same rationale as `requirePlacementsArrayNode`: the exact known path to the
 * placement `courseKey` string property, patched with an `enum` of every
 * curriculum course key so a schema-valid registry can never name a course
 * the runtime's `isKnownCourseKey` would reject. Canonical placement SORT
 * ORDER has no JSON Schema equivalent at all (no keyword expresses "this
 * array is sorted by a field across all items") — the Zod `superRefine`
 * remains the sole authority for that invariant; this schema is a necessary,
 * not sufficient, pre-filter.
 */
function requireCourseKeyNode(schema: JsonSchemaNode): JsonSchemaNode {
  const placements = requirePlacementsArrayNode(schema);
  const items = placements.items as JsonSchemaNode | undefined;
  const courseKey = (items?.properties as JsonSchemaNode | undefined)
    ?.courseKey as JsonSchemaNode | undefined;
  if (!courseKey || courseKey.type !== 'string') {
    throw new Error('ARIA_RESOURCE_REGISTRY_SCHEMA_COURSE_KEY_NODE_MISSING');
  }
  return courseKey;
}

function schemaBytes(): Buffer {
  const schema = zodToJsonSchema(ariaResourceRegistrySchema, {
    name: 'AriaResourceRegistryV2',
    target: 'jsonSchema2019-09',
    effectStrategy: 'input',
    $refStrategy: 'root',
  }) as JsonSchemaNode;
  requirePlacementsArrayNode(schema).uniqueItems = true;
  requireCourseKeyNode(schema).enum = [...listCourseKeys()].sort();
  return Buffer.from(`${JSON.stringify({
    ...schema,
    $id: 'https://nexusreussite.academy/schemas/aria/resource-registry-v2.schema.json',
    title: 'ARIA canonical Resource Registry v2',
  }, null, 2)}\n`, 'utf8');
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
  writeJsonFileAtomic(output, expected);
}

if (require.main === module) {
  exportAriaResourceRegistrySchema({
    repositoryRoot: resolve(process.cwd()),
    check: process.argv.includes('--check'),
  });
}
