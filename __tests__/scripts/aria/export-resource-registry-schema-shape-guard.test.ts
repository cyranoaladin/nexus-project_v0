/**
 * `requirePlacementsArrayNode` patches the EXACT known JSON Schema path
 * `zod-to-json-schema` is expected to emit for the placements array, rather
 * than a generic deep search — it must fail loud, not silently skip the
 * `uniqueItems` patch, if that generator's shape ever drifts.
 */

const zodToJsonSchemaMock = jest.fn((_arg: unknown) => ({ definitions: {} }) as Record<string, unknown>);
jest.mock('zod-to-json-schema', () => ({
  zodToJsonSchema: (arg: unknown) => zodToJsonSchemaMock(arg),
}));

import { exportAriaResourceRegistrySchema } from '@/scripts/aria/export-resource-registry';

describe('export-resource-registry — schema shape guard', () => {
  it('throws ARIA_RESOURCE_REGISTRY_SCHEMA_PLACEMENTS_NODE_MISSING when the generator output no longer has the expected placements node', () => {
    expect(() => exportAriaResourceRegistrySchema({ repositoryRoot: '/tmp/does-not-matter', check: false }))
      .toThrow('ARIA_RESOURCE_REGISTRY_SCHEMA_PLACEMENTS_NODE_MISSING');
  });

  it('throws ARIA_RESOURCE_REGISTRY_SCHEMA_COURSE_KEY_NODE_MISSING when the placements node exists but its courseKey property does not', () => {
    zodToJsonSchemaMock.mockReturnValueOnce({
      definitions: {
        AriaResourceRegistryV2: {
          properties: {
            resources: {
              items: {
                properties: {
                  placements: {
                    type: 'array',
                    minItems: 1,
                    items: { type: 'object', properties: {} },
                  },
                },
              },
            },
          },
        },
      },
    });
    expect(() => exportAriaResourceRegistrySchema({ repositoryRoot: '/tmp/does-not-matter', check: false }))
      .toThrow('ARIA_RESOURCE_REGISTRY_SCHEMA_COURSE_KEY_NODE_MISSING');
  });
});
