import 'server-only';

import { z } from 'zod';

export const OpenRouterContractTestSchema = z.object({
  schemaVersion: z.literal('openrouter-contract-test-v1'),
  status: z.literal('ok'),
  echo: z.literal('synthetic-no-pii'),
}).strict();

export const OPENROUTER_CONTRACT_TEST_JSON_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'status', 'echo'],
  properties: {
    schemaVersion: {
      type: 'string',
      const: 'openrouter-contract-test-v1',
    },
    status: {
      type: 'string',
      const: 'ok',
    },
    echo: {
      type: 'string',
      const: 'synthetic-no-pii',
    },
  },
});
