import {
  assertAriaCitationsMatchRetrievalEvidence,
  createAriaTurnRetrievalAudit,
  type AriaGroundingHit,
} from '@/lib/aria/application/conversation/retrieval-evidence';
import {
  registerAriaTurnCancellation,
  requestLocalAriaTurnCancellation,
  unregisterAriaTurnCancellation,
} from '@/lib/aria/application/conversation/cancellation-registry';

const evidence: AriaGroundingHit = {
  id: 'hit-1',
  resourceId: 'resource-1',
  resourceVersionId: 'version-1',
  contentSha256: 'a'.repeat(64),
  chunkId: 'chunk-1',
  locator: { page: 2 },
  corpusId: 'maths-premiere',
  corpusVersionId: 'corpus-version-1',
  manifestSha256: 'b'.repeat(64),
  sourceTitle: 'Programme',
  sourceDocument: 'programme.pdf',
  sourceLocation: 'Page 2',
  courseKey: 'eds-maths-premiere',
  provenance: 'OFFICIEL_MEN',
  snippet: 'Extrait',
};
const audit = createAriaTurnRetrievalAudit({ status: 'SUCCESS', hits: [evidence] });

describe('ARIA TX2 retrieval/citation integrity', () => {
  it('accepts only an exact citation subset of the current Turn retrieval evidence', () => {
    expect(assertAriaCitationsMatchRetrievalEvidence([evidence], audit)).toEqual([evidence]);
    expect(assertAriaCitationsMatchRetrievalEvidence([], audit)).toEqual([]);
  });

  it.each([
    ['resourceId', 'resource-2'],
    ['resourceVersionId', 'version-2'],
    ['contentSha256', 'c'.repeat(64)],
    ['chunkId', 'chunk-2'],
    ['corpusId', 'other-corpus'],
    ['corpusVersionId', 'corpus-version-2'],
    ['manifestSha256', 'd'.repeat(64)],
  ] as const)('rejects a citation whose %s was not retrieved by this Turn', (field, value) => {
    expect(() => assertAriaCitationsMatchRetrievalEvidence(
      [{ ...evidence, [field]: value }],
      audit,
    )).toThrow(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
  });

  it('U023 ARIA-B-R040 rejects missing canonical identity fields instead of creating a second document truth', () => {
    const incomplete = { ...evidence, resourceVersionId: '' };
    expect(() => createAriaTurnRetrievalAudit({ status: 'SUCCESS', hits: [incomplete] }))
      .toThrow(expect.objectContaining({ code: 'RAG_UNAVAILABLE' }));
    expect(() => assertAriaCitationsMatchRetrievalEvidence([incomplete], audit))
      .toThrow(expect.objectContaining({
        code: 'RAG_UNAVAILABLE',
        internalDetails: { reasonCode: 'CITATION_IDENTITY_INCOMPLETE' },
      }));
  });

  it('records an explicit empty audit when retrieval was not attempted', () => {
    expect(createAriaTurnRetrievalAudit({ status: 'NOT_CONFIGURED', hits: [] })).toEqual({
      schemaVersion: 1,
      hits: [],
    });
  });

  it.each([
    {
      schemaVersion: 1,
      manifestSha256: 'b'.repeat(64),
      hits: [],
    },
    {
      schemaVersion: 1,
      hits: [{
        resourceId: evidence.resourceId,
        resourceVersionId: evidence.resourceVersionId,
        contentSha256: evidence.contentSha256,
        chunkId: evidence.chunkId,
        locator: evidence.locator,
      }],
    },
  ])('rejects incomplete attempted retrieval identity in persisted evidence', (invalidAudit) => {
    expect(() => assertAriaCitationsMatchRetrievalEvidence([], invalidAudit)).toThrow(
      expect.objectContaining({
        code: 'RAG_UNAVAILABLE',
        internalDetails: { reasonCode: 'RETRIEVAL_EVIDENCE_INVALID' },
      }),
    );
  });

  it('rejects retrieval hits that claim another attempted corpus identity', () => {
    expect(() => createAriaTurnRetrievalAudit({
      status: 'SUCCESS',
      attempted: {
        manifestSha256: evidence.manifestSha256,
        corpusId: evidence.corpusId,
        corpusVersionId: evidence.corpusVersionId,
      },
      hits: [{ ...evidence, corpusId: 'another-corpus' }],
    })).toThrow(expect.objectContaining({
      code: 'RAG_UNAVAILABLE',
      internalDetails: { reasonCode: 'RETRIEVAL_HIT_CORPUS_IDENTITY_MISMATCH' },
    }));
  });

  it('compares locator identity independently of object property insertion order', () => {
    const citation = { ...evidence, locator: { page: 2, section: 'A' } };
    const orderedAudit = createAriaTurnRetrievalAudit({
      status: 'SUCCESS',
      hits: [{ ...evidence, locator: { section: 'A', page: 2 } }],
    });

    expect(assertAriaCitationsMatchRetrievalEvidence([citation], orderedAudit)).toEqual([citation]);
  });

  it('rejects bounded-field evidence whose aggregate payload exceeds the Turn audit cap', () => {
    const longValue = 'x'.repeat(500);
    const locator = Object.fromEntries(Array.from(
      { length: 12 },
      (_, index) => [`field-${index}`, longValue],
    ));
    const oversizedHits = Array.from({ length: 20 }, (_, index) => ({
      ...evidence,
      id: `hit-${index}`,
      resourceId: `resource-${index}-${'r'.repeat(180)}`,
      resourceVersionId: `version-${index}-${'v'.repeat(180)}`,
      chunkId: `chunk-${index}-${'c'.repeat(180)}`,
      locator,
    }));

    expect(() => createAriaTurnRetrievalAudit({ status: 'SUCCESS', hits: oversizedHits }))
      .toThrow(expect.objectContaining({
        code: 'RAG_UNAVAILABLE',
        internalDetails: { reasonCode: 'RETRIEVAL_EVIDENCE_INVALID_OR_OVERSIZED' },
      }));
  });

  it('registers, cancels and unregisters the exact fenced execution idempotently', () => {
    const signal = registerAriaTurnCancellation('turn-cancel', 'token-current');
    expect(requestLocalAriaTurnCancellation('turn-cancel', 'token-stale')).toBe(false);
    expect(signal.aborted).toBe(false);
    expect(requestLocalAriaTurnCancellation('turn-cancel', 'token-current')).toBe(true);
    expect(requestLocalAriaTurnCancellation('turn-cancel', 'token-current')).toBe(true);
    expect(signal.aborted).toBe(true);
    unregisterAriaTurnCancellation('turn-cancel', 'token-stale');
    expect(requestLocalAriaTurnCancellation('turn-cancel', 'token-current')).toBe(true);
    unregisterAriaTurnCancellation('turn-cancel', 'token-current');
    expect(requestLocalAriaTurnCancellation('turn-cancel', 'token-current')).toBe(false);
  });

  it('aborts a superseded local execution when the same turn is re-fenced', () => {
    const superseded = registerAriaTurnCancellation('turn-replaced', 'token-old');
    const current = registerAriaTurnCancellation('turn-replaced', 'token-new');

    expect(superseded.aborted).toBe(true);
    expect(superseded.reason).toBe('EXECUTION_REPLACED');
    expect(current.aborted).toBe(false);
    expect(requestLocalAriaTurnCancellation('turn-replaced', 'token-new')).toBe(true);
    unregisterAriaTurnCancellation('turn-replaced', 'token-new');
  });
});
