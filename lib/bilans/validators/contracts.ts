import { z } from 'zod';

export const BILAN_AGENT_IDS = [
  'preAnalysis',
  'eleve',
  'parents',
  'nexus',
  'verifier',
] as const;

export type BilanAgentId = (typeof BILAN_AGENT_IDS)[number];

export type AgentOutputJsonSchema =
  | Readonly<{ type: 'string'; minLength?: number }>
  | Readonly<{ type: 'boolean' }>
  | Readonly<{ type: 'number' | 'integer'; minimum?: number }>
  | Readonly<{
    type: 'array';
    items: AgentOutputJsonSchema;
    minItems?: number;
    maxItems?: number;
  }>
  | Readonly<{
    type: 'object';
    properties: Readonly<Record<string, AgentOutputJsonSchema>>;
    required: readonly string[];
    additionalProperties: false;
  }>;

export const agentOutputJsonSchema: z.ZodType<AgentOutputJsonSchema> = z.lazy(() => z.union([
  z.object({ type: z.literal('string'), minLength: z.number().int().nonnegative().optional() }).strict(),
  z.object({ type: z.literal('boolean') }).strict(),
  z.object({
    type: z.enum(['number', 'integer']),
    minimum: z.number().optional(),
  }).strict(),
  z.object({
    type: z.literal('array'),
    items: agentOutputJsonSchema,
    minItems: z.number().int().nonnegative().optional(),
    maxItems: z.number().int().nonnegative().optional(),
  }).strict(),
  z.object({
    type: z.literal('object'),
    properties: z.record(agentOutputJsonSchema),
    required: z.array(z.string().trim().min(1)),
    additionalProperties: z.literal(false),
  }).strict(),
])) as z.ZodType<AgentOutputJsonSchema>;

export const promptRefSchema = z.object({
  path: z.string().trim().min(1),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

const promptFilesSchema = z.object({
  preAnalysis: promptRefSchema,
  eleve: promptRefSchema,
  parents: promptRefSchema,
  nexus: promptRefSchema,
  verifier: promptRefSchema,
}).strict();

const outputSchemasSchema = z.object({
  preAnalysis: agentOutputJsonSchema,
  eleve: agentOutputJsonSchema,
  parents: agentOutputJsonSchema,
  nexus: agentOutputJsonSchema,
  verifier: agentOutputJsonSchema,
}).strict();

const validatedPackSchema = z.object({
  slug: z.string().trim().min(1),
  version: z.number().int().positive(),
  status: z.literal('VALIDATED'),
  review: z.object({
    validatedBy: z.string().trim().min(1),
    validatedAt: z.string().datetime({ offset: true }),
  }).strict(),
  scoring: z.object({ domains: z.array(z.string().trim().min(1)).min(1) }).strict(),
  reporting: z.object({
    promptFiles: promptFilesSchema,
    outputSchemas: outputSchemasSchema,
  }).strict(),
  validation: z.object({
    lexiconPath: z.literal('data/bilans/lexique-interdit.json'),
    forbidDigits: z.array(z.enum(['eleve', 'parents'])).min(1),
  }).strict(),
}).strict().superRefine(({ scoring }, context) => {
  if (new Set(scoring.domains).size !== scoring.domains.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['scoring', 'domains'], message: 'Pack domains must be unique' });
  }
});

declare const validatedPackBrand: unique symbol;
export type ValidatedPack = z.infer<typeof validatedPackSchema> & { readonly [validatedPackBrand]: true };

export function buildValidatedPack(input: unknown): ValidatedPack {
  return Object.freeze(validatedPackSchema.parse(input)) as ValidatedPack;
}
