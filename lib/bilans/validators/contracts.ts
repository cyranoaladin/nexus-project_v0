import { z } from 'zod';

const promptRefSchema = z.object({
  path: z.string().trim().min(1),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
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
    promptFiles: z.object({
      preAnalysis: promptRefSchema,
      eleve: promptRefSchema,
      parents: promptRefSchema,
      nexus: promptRefSchema,
      verifier: promptRefSchema,
    }).strict(),
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
