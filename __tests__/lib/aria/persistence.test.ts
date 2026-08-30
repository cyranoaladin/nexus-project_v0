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

  it('rejects missing canonical identity fields instead of creating a second document truth', () => {
    const incomplete = { ...evidence, resourceVersionId: '' };
    expect(() => createAriaTurnRetrievalAudit({ status: 'SUCCESS', hits: [incomplete] }))
      .toThrow(expect.objectContaining({ code: 'RAG_UNAVAILABLE' }));
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
});
