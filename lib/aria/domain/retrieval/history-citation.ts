import { z } from 'zod';

const identifierSchema = z.string().min(1).max(200);
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const locatorSchema = z.record(z.string().min(1).max(80), z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
])).refine((locator) => Object.keys(locator).length <= 12);

const displayFields = {
  id: identifierSchema,
  sourceTitle: z.string().min(1).max(500),
  sourceDocument: z.string().min(1).max(1_000),
  sourceLocation: z.string().max(500).nullable(),
  courseKey: identifierSchema,
  provenance: identifierSchema,
};

const canonicalHistoryCitationSchema = z.object({
  traceability: z.literal('CANONICAL'),
  ...displayFields,
  url: z.string().url().max(2_048).nullable(),
  resourceId: identifierSchema,
  resourceVersionId: identifierSchema,
  contentSha256: sha256Schema,
  chunkId: identifierSchema,
  locator: locatorSchema,
  corpusId: identifierSchema,
  corpusVersionId: identifierSchema,
  manifestSha256: sha256Schema,
}).strict();

const legacyHistoryCitationSchema = z.object({
  traceability: z.literal('LEGACY_UNTRACEABLE'),
  ...displayFields,
  courseKey: z.null(),
  url: z.null(),
  resourceId: z.null(),
  resourceVersionId: z.null(),
  contentSha256: z.null(),
  chunkId: z.null(),
  locator: z.null(),
  corpusId: z.null(),
  corpusVersionId: z.null(),
  manifestSha256: z.null(),
}).strict();

export const ariaHistoryCitationSchema = z.discriminatedUnion('traceability', [
  canonicalHistoryCitationSchema,
  legacyHistoryCitationSchema,
]);

export type AriaHistoryCitation = z.infer<typeof ariaHistoryCitationSchema>;
export type AriaCanonicalHistoryCitation = z.infer<typeof canonicalHistoryCitationSchema>;
