/**
 * The zod schema (app-side validation) and the hand-written JSON Schema
 * (sent to the provider as response_format.json_schema.schema) are two
 * independent artifacts by design (mission §3: "la simple présence de
 * response_format dans un catalogue ne remplace pas la validation du
 * contrat exact demandé") — this test is what keeps them from silently
 * drifting apart, since neither is derived from the other.
 */
import { BILAN_AI_JSON_SCHEMA, bilanAiProposalSchema } from '@/lib/core-v2/diagnostics/bilan-ai-schema';

const VALID_SAMPLE = {
  items: [{ itemId: 'item-2', constat: 'x', preuve: 'y', incertitude: false }],
  pointsAppui: ['a'],
  difficultesObservees: [],
  prioritesTravail: [],
  propositionsRemediation: [],
};

describe('BILAN_AI_JSON_SCHEMA — strict-mode compatibility', () => {
  test('every object level sets additionalProperties: false and lists every property in required', () => {
    expect(BILAN_AI_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(new Set(BILAN_AI_JSON_SCHEMA.required)).toEqual(new Set(Object.keys(BILAN_AI_JSON_SCHEMA.properties)));

    const itemSchema = BILAN_AI_JSON_SCHEMA.properties.items.items;
    expect(itemSchema.additionalProperties).toBe(false);
    expect(new Set(itemSchema.required)).toEqual(new Set(Object.keys(itemSchema.properties)));
  });

  test('a value satisfying the JSON schema field set also satisfies the zod schema, and vice versa', () => {
    expect(bilanAiProposalSchema.safeParse(VALID_SAMPLE).success).toBe(true);
    expect(Object.keys(VALID_SAMPLE).sort()).toEqual([...BILAN_AI_JSON_SCHEMA.required].sort());
    expect(Object.keys(VALID_SAMPLE.items[0]).sort()).toEqual([...BILAN_AI_JSON_SCHEMA.properties.items.items.required].sort());
  });

  test('the zod schema rejects an extra, undeclared key — matching additionalProperties: false', () => {
    const withExtra = { ...VALID_SAMPLE, scoreGlobal: 14 };
    expect(bilanAiProposalSchema.safeParse(withExtra).success).toBe(false);
  });

  test('the zod schema rejects a missing required array — matching the JSON schema\'s required list', () => {
    const { pointsAppui, ...missing } = VALID_SAMPLE;
    void pointsAppui;
    expect(bilanAiProposalSchema.safeParse(missing).success).toBe(false);
  });
});
