import { AriaError } from '../../errors';
import {
  ariaHistoryCitationSchema,
  type AriaCanonicalHistoryCitation,
  type AriaHistoryCitation,
} from '../../domain/retrieval/history-citation';
import {
  assertAriaCitationsMatchRetrievalEvidence,
  canonicalizeAriaGroundingHit,
  type AriaCanonicalGroundingHit,
  type AriaGroundingHit,
} from '../../application/conversation/retrieval-evidence';

export interface PersistedAriaCitationRow {
  readonly id: string;
  readonly sourceTitle: string;
  readonly sourceDocument: string;
  readonly sourceLocation: string | null;
  readonly courseKey: string;
  readonly provenance: string;
  readonly url: string | null;
  readonly resourceId: string | null;
  readonly resourceVersionId: string | null;
  readonly contentSha256: string | null;
  readonly chunkId: string | null;
  readonly locator: unknown;
  readonly corpusId: string | null;
  readonly corpusVersionId: string | null;
  readonly manifestSha256: string | null;
}

function persistedCitationError(reasonCode: string): never {
  throw new AriaError(
    'INTERNAL_ERROR',
    500,
    'Une citation historique ne respecte pas le contrat ARIA.',
    { reasonCode },
  );
}

export function canonicalizeAriaCitationForPersistence(
  citation: AriaGroundingHit,
  expectedCourseKey: string,
): AriaCanonicalGroundingHit {
  try {
    return canonicalizeAriaGroundingHit(citation, expectedCourseKey);
  } catch {
    return persistedCitationError('PERSISTED_CITATION_CONTRACT_INVALID');
  }
}

function canonicalizePersistedCitation(
  citation: AriaCanonicalHistoryCitation,
  expectedCourseKey: string,
): AriaCanonicalHistoryCitation {
  let canonical: AriaGroundingHit;
  try {
    canonical = canonicalizeAriaGroundingHit(toGroundingHit(citation), expectedCourseKey);
  } catch {
    return persistedCitationError('PERSISTED_CITATION_CONTRACT_INVALID');
  }
  return Object.freeze({
    ...citation,
    sourceTitle: canonical.sourceTitle,
    sourceDocument: canonical.sourceDocument,
    sourceLocation: canonical.sourceLocation ?? null,
    provenance: canonical.provenance,
    // Registry-backed canonicalization always supplies the required HTTPS URI.
    url: canonical.url!,
  });
}

function classifyPersistedCitation(row: PersistedAriaCitationRow): AriaHistoryCitation {
  const identity = [
    row.resourceId,
    row.resourceVersionId,
    row.contentSha256,
    row.chunkId,
    row.locator,
    row.corpusId,
    row.corpusVersionId,
    row.manifestSha256,
  ];
  const isLegacy = identity.every((value) => value === null);
  const parsed = ariaHistoryCitationSchema.safeParse(isLegacy ? {
    ...row,
    traceability: 'LEGACY_UNTRACEABLE',
    sourceTitle: 'Référence historique',
    sourceDocument: 'Provenance non vérifiable',
    sourceLocation: null,
    courseKey: null,
    provenance: 'LEGACY_UNVERIFIED',
    url: null,
  } : { ...row, traceability: 'CANONICAL' });
  if (!parsed.success) return persistedCitationError('PERSISTED_CITATION_CONTRACT_INVALID');
  return parsed.data;
}

function toGroundingHit(citation: AriaCanonicalHistoryCitation): AriaGroundingHit {
  return {
    id: citation.id,
    resourceId: citation.resourceId,
    resourceVersionId: citation.resourceVersionId,
    contentSha256: citation.contentSha256,
    chunkId: citation.chunkId,
    locator: citation.locator,
    corpusId: citation.corpusId,
    corpusVersionId: citation.corpusVersionId,
    manifestSha256: citation.manifestSha256,
    sourceTitle: citation.sourceTitle,
    sourceDocument: citation.sourceDocument,
    sourceLocation: citation.sourceLocation ?? undefined,
    courseKey: citation.courseKey,
    provenance: citation.provenance,
    // Canonicalization above derives this from the registry's required HTTPS source URI.
    url: citation.url!,
    snippet: '',
  };
}

function verifyCanonicalCitation(input: {
  readonly citation: AriaCanonicalHistoryCitation;
  readonly retrievalEvidence: unknown;
  readonly expectedCourseKey: string;
}): AriaGroundingHit {
  const groundingHit = toGroundingHit(input.citation);
  try {
    assertAriaCitationsMatchRetrievalEvidence(
      [groundingHit],
      input.retrievalEvidence,
    );
  } catch {
    return persistedCitationError('PERSISTED_CITATION_CONTRACT_INVALID');
  }
  return groundingHit;
}

export function projectPersistedAriaReplayCitation(input: {
  readonly row: PersistedAriaCitationRow;
  readonly retrievalEvidence: unknown;
  readonly expectedCourseKey: string;
}): AriaGroundingHit {
  const citation = classifyPersistedCitation(input.row);
  if (citation.traceability !== 'CANONICAL') {
    return persistedCitationError('LEGACY_CITATION_IDENTITY_UNRESOLVED');
  }
  const canonical = canonicalizePersistedCitation(citation, input.expectedCourseKey);
  return verifyCanonicalCitation({
    citation: canonical,
    retrievalEvidence: input.retrievalEvidence,
    expectedCourseKey: input.expectedCourseKey,
  });
}

export function projectPersistedAriaHistoryCitation(input: {
  readonly row: PersistedAriaCitationRow;
  readonly retrievalEvidence: unknown;
  readonly expectedCourseKey: string | null;
  readonly canonicalConversationTurn: boolean;
}): AriaHistoryCitation {
  const isLegacyIdentity = [
    input.row.resourceId,
    input.row.resourceVersionId,
    input.row.contentSha256,
    input.row.chunkId,
    input.row.locator,
    input.row.corpusId,
    input.row.corpusVersionId,
    input.row.manifestSha256,
  ].every((value) => value === null);
  if (
    isLegacyIdentity
    && input.expectedCourseKey !== null
    && input.row.courseKey !== input.expectedCourseKey
  ) {
    return persistedCitationError('PERSISTED_CITATION_CONTRACT_INVALID');
  }
  const citation = classifyPersistedCitation(input.row);
  if (citation.traceability === 'LEGACY_UNTRACEABLE') {
    if (
      input.canonicalConversationTurn
    ) {
      return persistedCitationError('PERSISTED_CITATION_CONTRACT_INVALID');
    }
    return citation;
  }
  if (!input.canonicalConversationTurn || !input.expectedCourseKey) {
    return persistedCitationError('PERSISTED_CITATION_CONTRACT_INVALID');
  }
  const canonical = canonicalizePersistedCitation(citation, input.expectedCourseKey);
  verifyCanonicalCitation({
    citation: canonical,
    retrievalEvidence: input.retrievalEvidence,
    expectedCourseKey: input.expectedCourseKey,
  });
  return canonical;
}
