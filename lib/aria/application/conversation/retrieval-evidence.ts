import { z } from 'zod';
import { AriaError } from '../../kernel/errors';
import type { AriaRagStatus } from '../../domain/retrieval/policy';

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const identifierSchema = z.string().min(1).max(200);
const locatorSchema = z.record(z.string().min(1).max(80), z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
])).refine((locator) => Object.keys(locator).length <= 12);

const evidenceHitSchema = z.object({
  resourceId: identifierSchema,
  resourceVersionId: identifierSchema,
  contentSha256: sha256Schema,
  chunkId: identifierSchema,
  locator: locatorSchema,
}).strict();

const retrievalAuditSchema = z.object({
  schemaVersion: z.literal(1),
  manifestSha256: sha256Schema.optional(),
  corpusId: identifierSchema.optional(),
  corpusVersionId: identifierSchema.optional(),
  hits: z.array(evidenceHitSchema).max(20),
}).strict().superRefine((value, context) => {
  const attemptedFields = [value.manifestSha256, value.corpusId, value.corpusVersionId];
  const present = attemptedFields.filter(Boolean).length;
  if (present !== 0 && present !== attemptedFields.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'ARIA_RETRIEVAL_ATTEMPT_IDENTITY_INCOMPLETE' });
  }
  if (value.hits.length > 0 && present !== attemptedFields.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'ARIA_RETRIEVAL_IDENTITY_INCOMPLETE' });
  }
});

export type AriaTurnRetrievalEvidence = z.infer<typeof evidenceHitSchema>;
export interface AriaTurnRetrievalAudit {
  readonly schemaVersion: 1;
  readonly manifestSha256?: string;
  readonly corpusId?: string;
  readonly corpusVersionId?: string;
  readonly hits: readonly AriaTurnRetrievalEvidence[];
}

export interface AriaGroundingHit extends AriaTurnRetrievalEvidence {
  readonly id: string;
  readonly manifestSha256: string;
  readonly corpusId: string;
  readonly corpusVersionId: string;
  readonly sourceTitle: string;
  readonly sourceDocument: string;
  readonly sourceLocation?: string;
  readonly courseKey: string;
  readonly provenance: string;
  readonly url?: string;
  readonly snippet: string;
  readonly score?: number;
}

export interface AriaRetrievalAttemptIdentity {
  readonly manifestSha256: string;
  readonly corpusId: string;
  readonly corpusVersionId: string;
}

export interface AriaCanonicalRetrievalOutcome {
  readonly status: AriaRagStatus;
  readonly hits: readonly AriaGroundingHit[];
  readonly attempted?: AriaRetrievalAttemptIdentity;
  readonly failureReason?: string;
}

function retrievalUnavailable(reasonCode: string): never {
  throw new AriaError('RAG_UNAVAILABLE', 503, 'La provenance documentaire ARIA est indisponible.', {
    reasonCode,
  });
}

export function createAriaTurnRetrievalAudit(
  outcome: AriaCanonicalRetrievalOutcome,
): AriaTurnRetrievalAudit {
  const first = outcome.hits[0];
  const attempted = outcome.attempted ?? (first ? {
    manifestSha256: first.manifestSha256,
    corpusId: first.corpusId,
    corpusVersionId: first.corpusVersionId,
  } : undefined);
  if (outcome.hits.some((hit) => !attempted
    || hit.manifestSha256 !== attempted.manifestSha256
    || hit.corpusId !== attempted.corpusId
    || hit.corpusVersionId !== attempted.corpusVersionId)) {
    return retrievalUnavailable('RETRIEVAL_HIT_CORPUS_IDENTITY_MISMATCH');
  }
  const candidate = {
    schemaVersion: 1 as const,
    ...(attempted ?? {}),
    hits: outcome.hits.map((hit) => ({
      resourceId: hit.resourceId,
      resourceVersionId: hit.resourceVersionId,
      contentSha256: hit.contentSha256,
      chunkId: hit.chunkId,
      locator: hit.locator,
    })),
  };
  const parsed = retrievalAuditSchema.safeParse(candidate);
  if (!parsed.success || Buffer.byteLength(JSON.stringify(candidate), 'utf8') > 64 * 1024) {
    return retrievalUnavailable('RETRIEVAL_EVIDENCE_INVALID_OR_OVERSIZED');
  }
  return Object.freeze({ ...parsed.data, hits: Object.freeze(parsed.data.hits) });
}

function sameLocator(left: Readonly<Record<string, unknown>>, right: Readonly<Record<string, unknown>>): boolean {
  const canonical = (value: Readonly<Record<string, unknown>>) => JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))),
  );
  return canonical(left) === canonical(right);
}

export function assertAriaCitationsMatchRetrievalEvidence(
  citations: readonly AriaGroundingHit[],
  evidence: AriaTurnRetrievalAudit,
): readonly AriaGroundingHit[] {
  const parsedEvidence = retrievalAuditSchema.safeParse(evidence);
  if (!parsedEvidence.success) return retrievalUnavailable('RETRIEVAL_EVIDENCE_INVALID');
  for (const citation of citations) {
    const citationIdentity = evidenceHitSchema.safeParse({
      resourceId: citation.resourceId,
      resourceVersionId: citation.resourceVersionId,
      contentSha256: citation.contentSha256,
      chunkId: citation.chunkId,
      locator: citation.locator,
    });
    if (!citationIdentity.success) return retrievalUnavailable('CITATION_IDENTITY_INCOMPLETE');
    const belongsToTurn = parsedEvidence.data.hits.some((hit) =>
      hit.resourceId === citation.resourceId
      && hit.resourceVersionId === citation.resourceVersionId
      && hit.contentSha256 === citation.contentSha256
      && hit.chunkId === citation.chunkId
      && sameLocator(hit.locator, citation.locator)
      && parsedEvidence.data.corpusId === citation.corpusId
      && parsedEvidence.data.corpusVersionId === citation.corpusVersionId
      && parsedEvidence.data.manifestSha256 === citation.manifestSha256);
    if (!belongsToTurn) {
      throw new AriaError('INTERNAL_ERROR', 500, 'Citation ARIA incohérente.', {
        reasonCode: 'CITATION_NOT_RETRIEVED_BY_TURN',
      });
    }
  }
  return citations;
}
