/**
 * Companion to `export-resource-registry-schema-shape-guard.test.ts`, which
 * fully mocks `zod-to-json-schema` and therefore only proves the guard's
 * negative branch (throws when the node is absent). This file runs the REAL,
 * un-mocked generator over the real `ariaResourceRegistrySchema` and proves
 * `requirePlacementsArrayNode`'s hardcoded navigation path
 * (`definitions.AriaResourceRegistryV2.properties.resources.items.properties.placements`)
 * actually matches what `zod-to-json-schema` emits today, and that the
 * `uniqueItems` patch lands on that real node.
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listCourseKeys } from '@/lib/curriculum/catalog';
import { exportAriaResourceRegistrySchema } from '@/scripts/aria/export-resource-registry';

describe('export-resource-registry — real generator shape', () => {
  it('locates the real placements/courseKey nodes zod-to-json-schema emits and patches both', () => {
    const root = mkdtempSync(join(tmpdir(), 'aria-schema-shape-'));
    exportAriaResourceRegistrySchema({ repositoryRoot: root, check: false });
    const schema = JSON.parse(readFileSync(
      join(root, 'data/aria/schemas/resource-registry-v2.schema.json'), 'utf8',
    ));
    const placements = schema
      .definitions.AriaResourceRegistryV2.properties.resources.items.properties.placements;
    expect(placements.type).toBe('array');
    expect(placements.uniqueItems).toBe(true);
    expect(placements.minItems).toBe(1);

    const courseKey = placements.items.properties.courseKey;
    expect(courseKey.type).toBe('string');
    expect(new Set(courseKey.enum)).toEqual(new Set(listCourseKeys()));
  });
});
