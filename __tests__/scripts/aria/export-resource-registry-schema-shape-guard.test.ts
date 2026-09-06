/**
 * `requirePlacementsArrayNode` patches the EXACT known JSON Schema path
 * `zod-to-json-schema` is expected to emit for the placements array, rather
 * than a generic deep search — it must fail loud, not silently skip the
 * `uniqueItems` patch, if that generator's shape ever drifts.
 */

jest.mock('zod-to-json-schema', () => ({
  zodToJsonSchema: jest.fn(() => ({ definitions: {} })),
}));

import { exportAriaResourceRegistrySchema } from '@/scripts/aria/export-resource-registry';

describe('export-resource-registry — schema shape guard', () => {
  it('throws ARIA_RESOURCE_REGISTRY_SCHEMA_PLACEMENTS_NODE_MISSING when the generator output no longer has the expected placements node', () => {
    expect(() => exportAriaResourceRegistrySchema({ repositoryRoot: '/tmp/does-not-matter', check: false }))
      .toThrow('ARIA_RESOURCE_REGISTRY_SCHEMA_PLACEMENTS_NODE_MISSING');
  });
});
