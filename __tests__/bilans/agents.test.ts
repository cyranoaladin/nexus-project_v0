import { loadAgentDefinitions, parseAgentOutput } from '@/lib/bilans/agents';
import { MockBilanLlmTransport } from '@/lib/bilans/llm/mock-transport';

import { VALIDATED_PACK_FIXTURE as pack } from './fixtures/validated-pack';
import { RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

describe('pack-bound bilan agents', () => {
  it('loads five prompt and output-schema definitions from the pack', () => {
    const definitions = loadAgentDefinitions(pack);
    expect(definitions.map(({ id }) => id)).toEqual(['preAnalysis', 'eleve', 'parents', 'nexus', 'verifier']);
    expect(definitions.every(({ prompt }) => prompt.length > 40)).toBe(true);
  });

  it('strictly parses every mock output with the schema carried by its agent definition', async () => {
    const transport = new MockBilanLlmTransport();
    const outputs: Record<string, unknown> = {};
    for (const definition of loadAgentDefinitions(pack)) {
      const raw = await transport.generate({
        schemaVersion: 'nexus-bilan-gateway/v1',
        pack: { slug: pack.slug, version: pack.version },
        agent: definition,
        factSheet: RECIPE_FACT_SHEETS[0],
        ragEvidence: [],
        priorOutputs: outputs,
      });
      outputs[definition.id] = parseAgentOutput(definition, raw);
    }
    expect(Object.keys(outputs)).toHaveLength(5);
  });

  it('rejects unknown output keys instead of silently stripping them', () => {
    const definition = loadAgentDefinitions(pack).find(({ id }) => id === 'verifier');
    expect(() => parseAgentOutput(definition!, { ok: true, violations: [], extra: true })).toThrow();
  });
});
