import {
  canonicalizeAriaCitationForPersistence,
  projectPersistedAriaHistoryCitation,
  projectPersistedAriaReplayCitation,
  type PersistedAriaCitationRow,
} from '@/lib/aria/infrastructure/prisma/persisted-citation';
import type { AriaGroundingHit } from '@/lib/aria/application/conversation/retrieval-evidence';

const canonicalRow: PersistedAriaCitationRow = {
  id: 'citation-1',
  sourceTitle: 'Programme officiel',
  sourceDocument: 'programme.pdf',
  sourceLocation: 'Page 2',
  courseKey: 'eds-maths-premiere',
  provenance: 'OFFICIEL_MEN',
  url: null,
  resourceId: '62c11386-3035-543b-a393-f025e5261312',
  resourceVersionId: '1ba3d1cd-8fc0-510a-9bcd-d5807cd4036a',
  contentSha256: '80b8ef1440548faeb5861adc764e6c9740cc2d2c806685287b72eabb5aeeea73',
  chunkId: 'chunk-1',
  locator: { page: 2 },
  corpusId: 'maths-premiere',
  corpusVersionId: 'corpus-version-1',
  manifestSha256: 'b'.repeat(64),
};

const evidence = {
  schemaVersion: 1,
  manifestSha256: canonicalRow.manifestSha256,
  corpusId: canonicalRow.corpusId,
  corpusVersionId: canonicalRow.corpusVersionId,
  hits: [{
    resourceId: canonicalRow.resourceId,
    resourceVersionId: canonicalRow.resourceVersionId,
    contentSha256: canonicalRow.contentSha256,
    chunkId: canonicalRow.chunkId,
    locator: canonicalRow.locator,
  }],
};

const canonicalHit: AriaGroundingHit = {
  id: canonicalRow.id,
  resourceId: canonicalRow.resourceId!,
  resourceVersionId: canonicalRow.resourceVersionId!,
  contentSha256: canonicalRow.contentSha256!,
  chunkId: canonicalRow.chunkId!,
  locator: canonicalRow.locator as Readonly<Record<string, string | number | boolean>>,
  corpusId: canonicalRow.corpusId!,
  corpusVersionId: canonicalRow.corpusVersionId!,
  manifestSha256: canonicalRow.manifestSha256!,
  sourceTitle: canonicalRow.sourceTitle,
  sourceDocument: canonicalRow.sourceDocument,
  sourceLocation: canonicalRow.sourceLocation ?? undefined,
  courseKey: canonicalRow.courseKey,
  provenance: canonicalRow.provenance,
  url: canonicalRow.url ?? undefined,
  snippet: 'Extrait vérifié',
};

const legacyRow: PersistedAriaCitationRow = {
  ...canonicalRow,
  resourceId: null,
  resourceVersionId: null,
  contentSha256: null,
  chunkId: null,
  locator: null,
  corpusId: null,
  corpusVersionId: null,
  manifestSha256: null,
};

function exactEvidenceFor(row: PersistedAriaCitationRow) {
  return {
    schemaVersion: 1,
    manifestSha256: row.manifestSha256,
    corpusId: row.corpusId,
    corpusVersionId: row.corpusVersionId,
    hits: [{
      resourceId: row.resourceId,
      resourceVersionId: row.resourceVersionId,
      contentSha256: row.contentSha256,
      chunkId: row.chunkId,
      locator: row.locator,
    }],
  };
}

describe('persisted ARIA citation boundary', () => {
  it('canonicalizes forged display metadata before persistence', () => {
    expect(canonicalizeAriaCitationForPersistence({
      ...canonicalHit,
      sourceTitle: 'Faux ministère',
      sourceDocument: '/srv/private/student@example.test.pdf',
      sourceLocation: '/home/private/programme.pdf',
      provenance: 'FORGED_OFFICIAL',
      url: 'https://attacker.example.test/programme.pdf',
    }, canonicalHit.courseKey)).toMatchObject({
      sourceTitle: 'Programme officiel — Spécialité Mathématiques Première (2019)',
      sourceDocument: 'BO spécial n° 1 du 22 janvier 2019 — NOR MENE1901632A',
      sourceLocation: 'Page 2',
      provenance: 'OFFICIEL_MEN',
      url: 'https://www.education.gouv.fr/bo/19/Special1/MENE1901632A.htm',
    });
  });

  it('rejects a citation outside the canonical Resource Registry before persistence', () => {
    expect(() => canonicalizeAriaCitationForPersistence({
      ...canonicalHit,
      resourceId: 'resource-does-not-exist',
    }, canonicalHit.courseKey)).toThrow(expect.objectContaining({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'PERSISTED_CITATION_CONTRACT_INVALID' },
    }));
  });

  it.each([
    ['missing page', {}],
    ['text page', { page: '2' }],
    ['fractional page', { page: 2.5 }],
    ['non-positive page', { page: 0 }],
  ])('does not expose a fabricated source location for %s', (_label, locator) => {
    expect(canonicalizeAriaCitationForPersistence({
      ...canonicalHit,
      locator,
    }, canonicalHit.courseKey)).toMatchObject({ sourceLocation: undefined });
  });

  it('omits source location on replay when the canonical locator has no public page', () => {
    const row = { ...canonicalRow, locator: { section: 'introduction' } };
    expect(projectPersistedAriaReplayCitation({
      row,
      retrievalEvidence: exactEvidenceFor(row),
      expectedCourseKey: canonicalRow.courseKey,
    })).toMatchObject({ sourceLocation: undefined });
  });

  it('projects only an evidence-matched canonical citation into replay', () => {
    const projected = projectPersistedAriaReplayCitation({
      row: canonicalRow,
      retrievalEvidence: evidence,
      expectedCourseKey: canonicalRow.courseKey,
    });
    expect(projected).toMatchObject({
      resourceId: canonicalRow.resourceId,
      resourceVersionId: canonicalRow.resourceVersionId,
      chunkId: 'chunk-1',
      snippet: '',
    });
    expect(projected).not.toHaveProperty('traceability');
  });

  it('derives public provenance from the canonical Resource Registry instead of persisted display fields', () => {
    expect(projectPersistedAriaReplayCitation({
      row: {
        ...canonicalRow,
        sourceTitle: 'Faux ministère',
        sourceDocument: '/srv/private/student@example.test.pdf',
        sourceLocation: '/home/private/programme.pdf',
        provenance: 'FORGED_OFFICIAL',
        url: 'https://attacker.example.test/programme.pdf',
      },
      retrievalEvidence: evidence,
      expectedCourseKey: canonicalRow.courseKey,
    })).toMatchObject({
      sourceTitle: 'Programme officiel — Spécialité Mathématiques Première (2019)',
      sourceDocument: 'BO spécial n° 1 du 22 janvier 2019 — NOR MENE1901632A',
      sourceLocation: 'Page 2',
      provenance: 'OFFICIEL_MEN',
      url: 'https://www.education.gouv.fr/bo/19/Special1/MENE1901632A.htm',
    });
    expect(JSON.stringify(projectPersistedAriaReplayCitation({
      row: {
        ...canonicalRow,
        sourceDocument: '/srv/private/student@example.test.pdf',
        sourceLocation: '/home/private/programme.pdf',
      },
      retrievalEvidence: evidence,
      expectedCourseKey: canonicalRow.courseKey,
    }))).not.toMatch(/\/srv|\/home|student@example\.test/);
  });

  it('preserves an all-null legacy citation only as display-only history', () => {
    expect(projectPersistedAriaHistoryCitation({
      row: legacyRow,
      retrievalEvidence: null,
      expectedCourseKey: canonicalRow.courseKey,
      canonicalConversationTurn: false,
    })).toMatchObject({
      traceability: 'LEGACY_UNTRACEABLE',
      courseKey: null,
      resourceId: null,
      locator: null,
      sourceTitle: 'Référence historique',
      sourceDocument: 'Provenance non vérifiable',
      sourceLocation: null,
      provenance: 'LEGACY_UNVERIFIED',
      url: null,
    });
    expect(() => projectPersistedAriaReplayCitation({
      row: legacyRow,
      retrievalEvidence: null,
      expectedCourseKey: canonicalRow.courseKey,
    })).toThrow(expect.objectContaining({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'LEGACY_CITATION_IDENTITY_UNRESOLVED' },
    }));
    expect(() => projectPersistedAriaHistoryCitation({
      row: legacyRow,
      retrievalEvidence: evidence,
      expectedCourseKey: canonicalRow.courseKey,
      canonicalConversationTurn: true,
    })).toThrow(expect.objectContaining({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'PERSISTED_CITATION_CONTRACT_INVALID' },
    }));
  });

  it('rejects a cross-course legacy citation when the conversation course is known', () => {
    expect(() => projectPersistedAriaHistoryCitation({
      row: legacyRow,
      retrievalEvidence: null,
      expectedCourseKey: 'eds-nsi-premiere',
      canonicalConversationTurn: false,
    })).toThrow(expect.objectContaining({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'PERSISTED_CITATION_CONTRACT_INVALID' },
    }));
  });

  it('keeps an unresolved legacy citation display-only without exposing stored paths or links', () => {
    const projected = projectPersistedAriaHistoryCitation({
      row: {
        ...legacyRow,
        sourceTitle: 'student@example.test',
        sourceDocument: '/srv/private/copy.pdf',
        sourceLocation: '/home/student/copy.pdf',
        url: 'file:///srv/private/copy.pdf',
      },
      retrievalEvidence: null,
      expectedCourseKey: null,
      canonicalConversationTurn: false,
    });
    expect(projected).toMatchObject({
      traceability: 'LEGACY_UNTRACEABLE',
      courseKey: null,
      sourceTitle: 'Référence historique',
      sourceDocument: 'Provenance non vérifiable',
      sourceLocation: null,
      provenance: 'LEGACY_UNVERIFIED',
      url: null,
    });
    expect(JSON.stringify(projected)).not.toMatch(/\/srv|\/home|student@example\.test|file:/);
  });

  it('projects a canonical history citation only for an evidence-backed Conversation Turn', () => {
    expect(projectPersistedAriaHistoryCitation({
      row: canonicalRow,
      retrievalEvidence: evidence,
      expectedCourseKey: canonicalRow.courseKey,
      canonicalConversationTurn: true,
    })).toMatchObject({ traceability: 'CANONICAL', resourceId: canonicalRow.resourceId });
  });

  it.each([
    ['partial identity', { ...canonicalRow, resourceVersionId: null }],
    ['invalid hash', { ...canonicalRow, contentSha256: 'invalid' }],
    ['nested locator', { ...canonicalRow, locator: { page: { number: 2 } } }],
    ['oversized locator', {
      ...canonicalRow,
      locator: Object.fromEntries(Array.from({ length: 13 }, (_, index) => [`key-${index}`, index])),
    }],
  ])('rejects persisted %s as INTERNAL contract corruption', (_label, row) => {
    expect(() => projectPersistedAriaHistoryCitation({
      row,
      retrievalEvidence: evidence,
      expectedCourseKey: canonicalRow.courseKey,
      canonicalConversationTurn: true,
    })).toThrow(expect.objectContaining({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'PERSISTED_CITATION_CONTRACT_INVALID' },
    }));
  });

  it.each([
    ['unknown resource', { ...canonicalRow, resourceId: 'resource-does-not-exist' }],
    ['unknown resource version', { ...canonicalRow, resourceVersionId: 'version-does-not-exist' }],
    ['registry hash mismatch', { ...canonicalRow, contentSha256: 'c'.repeat(64) }],
  ])('rejects persisted %s even when the Turn evidence repeats the forged identity', (_label, row) => {
    expect(() => projectPersistedAriaHistoryCitation({
      row,
      retrievalEvidence: exactEvidenceFor(row),
      expectedCourseKey: canonicalRow.courseKey,
      canonicalConversationTurn: true,
    })).toThrow(expect.objectContaining({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'PERSISTED_CITATION_CONTRACT_INVALID' },
    }));
  });

  it.each([
    ['missing canonical Turn', false, evidence, canonicalRow.courseKey],
    ['missing evidence', true, null, canonicalRow.courseKey],
    ['wrong course', true, evidence, 'eds-nsi-premiere'],
    ['detached evidence', true, {
      ...evidence,
      hits: [{ ...evidence.hits[0], chunkId: 'other-chunk' }],
    }, canonicalRow.courseKey],
  ])('rejects canonical history with %s', (_label, canonicalConversationTurn, retrievalEvidence, expectedCourseKey) => {
    expect(() => projectPersistedAriaHistoryCitation({
      row: canonicalRow,
      retrievalEvidence,
      expectedCourseKey,
      canonicalConversationTurn,
    })).toThrow(expect.objectContaining({
      code: 'INTERNAL_ERROR',
      internalDetails: { reasonCode: 'PERSISTED_CITATION_CONTRACT_INVALID' },
    }));
  });
});
