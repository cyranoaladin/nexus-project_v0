import { z, type ZodTypeAny } from 'zod';

import { readBoundPrompt } from '../catalog/load-pack';
import {
  BILAN_AGENT_IDS,
  type AgentOutputJsonSchema,
  type BilanAgentId,
  type ValidatedPack,
} from '../validators/contracts';

export type BilanAgentDefinition = Readonly<{
  id: BilanAgentId;
  prompt: string;
  outputSchema: AgentOutputJsonSchema;
}>;

function compileSchema(schema: AgentOutputJsonSchema): ZodTypeAny {
  switch (schema.type) {
    case 'string':
      return schema.minLength === undefined ? z.string() : z.string().min(schema.minLength);
    case 'boolean':
      return z.boolean();
    case 'number': {
      const number = z.number();
      return schema.minimum === undefined ? number : number.min(schema.minimum);
    }
    case 'integer': {
      const integer = z.number().int();
      return schema.minimum === undefined ? integer : integer.min(schema.minimum);
    }
    case 'array': {
      let array = z.array(compileSchema(schema.items));
      if (schema.minItems !== undefined) array = array.min(schema.minItems);
      if (schema.maxItems !== undefined) array = array.max(schema.maxItems);
      return array;
    }
    case 'object': {
      const required = new Set(schema.required);
      const shape = Object.fromEntries(Object.entries(schema.properties).map(([key, child]) => {
        const parsed = compileSchema(child);
        return [key, required.has(key) ? parsed : parsed.optional()];
      }));
      if ([...required].some((key) => !(key in schema.properties))) {
        throw new Error('PACK_AGENT_SCHEMA_REQUIRED_PROPERTY_MISSING');
      }
      return z.object(shape).strict();
    }
  }
}

export function loadAgentDefinitions(pack: ValidatedPack): readonly BilanAgentDefinition[] {
  return Object.freeze(BILAN_AGENT_IDS.map((id) => Object.freeze({
    id,
    prompt: readBoundPrompt(pack.reporting.promptFiles[id]),
    outputSchema: pack.reporting.outputSchemas[id],
  })));
}

export function parseAgentOutput(definition: BilanAgentDefinition, output: unknown): unknown {
  return compileSchema(definition.outputSchema).parse(output);
}
