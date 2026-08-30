jest.mock('@/lib/aria/infrastructure/rag/manifest', () => ({
  getAriaRagCorpusCapability: jest.fn(),
}));

import fixture from '@/data/aria/generated/rag-contracts/v1/fixtures/internal-identity-envelope-v1.json';
import {
  executeAriaRetrieval,
  resolveAriaRetrievalPlan,
  type AriaResolvedRagStudentIdentity,
} from '@/lib/aria/rag';
import {
  AriaRagEngineClientError,
  searchAriaRagV2,
} from '@/lib/aria/infrastructure/rag/rag-engine-client';
import { getAriaRagCorpusCapability } from '@/lib/aria/infrastructure/rag/manifest';

const mockCapability = getAriaRagCorpusCapability as jest.MockedFunction<typeof getAriaRagCorpusCapability>;
const RESOURCE_ID = '11111111-1111-4111-8111-111111111111';
const VERSION_ID = '22222222-2222-4222-8222-222222222222';
const CONTENT_SHA = 'd'.repeat(64);
const MANIFEST_SHA = fixture.request.manifest_sha256;
const LOCATOR = { page: 2 };

const identity: AriaResolvedRagStudentIdentity = Object.freeze({
  pseudonymousSubject: fixture.envelope.sub,
  niveau: 'premiere',
  voie: 'generale',
  matiere: 'mathematiques',
  statutEnseignement: 'specialite',
  candidat: 'scolarise',
  audience: 'aefe',
  schoolYear: '2026-2027',
  zone: 'aefe',
  statusDetail: 'aefe',
});

const executionDependencies = Object.freeze({
  clientConfig: {
    baseUrl: 'https://rag.internal.example',
    serviceToken: 't'.repeat(32),
    timeoutMs: 1_000,
    maxResponseBytes: 16_384,
  },
  signerConfig: {
    signingKey: 'k'.repeat(32),
    issuer: 'nexus-cockpit',
    audience: 'nexus-rag-engine',
    identityIssuer: 'nexus-cockpit',
    identityAudience: 'nexus-rag-engine',
  },
  now: () => new Date('2026-08-30T12:00:00Z'),
  createJti: () => 'aria-rag-jti-0001',
});

function availableCapability(courseKey: string) {
  return {
    status: 'AVAILABLE' as const,
    corpus: {
      corpusId: fixture.request.corpus_id,
      corpusVersionId: fixture.request.corpus_version_id,
      physicalCollection: fixture.retrievalScope.evidence_subject.collection,
      manifestSha256: MANIFEST_SHA,
      resourceRegistrySha256: 'a'.repeat(64),
      academicYear: '2026-2027',
      curriculumVersion: 'fr-national-2026',
      retrievalScope: fixture.retrievalScope,
      retrievalScopeSha256: fixture.retrievalScopeSha256,
      resourceBindings: [{
        resourceId: RESOURCE_ID,
        resourceVersionId: VERSION_ID,
        contentSha256: CONTENT_SHA,
        chunks: [{ chunkId: 'chunk-1', locator: LOCATOR }],
      }],
    },
    courseKey,
  };
}

function validResponse() {
  return {
    results: [{
      chunk_id: 'chunk-1',
      doc_id: 'doc-1',
      score: 0.85,
      title: 'Chapitre 3 : Dérivation',
      excerpt: 'Théorème de dérivation des fonctions composées.',
      citation: {
        source_label: 'Ministère de l’Éducation nationale',
        source_uri: 'https://education.gouv.fr/programme.pdf',
        rights: 'officiel_public',
        page: 2,
      },
      metadata: {},
      resource_id: RESOURCE_ID,
      resource_version_id: VERSION_ID,
      content_sha256: CONTENT_SHA,
      locator: LOCATOR,
      corpus_id: fixture.request.corpus_id,
      corpus_version_id: fixture.request.corpus_version_id,
      manifest_sha256: MANIFEST_SHA,
    }],
    filters_applied: {},
    warnings: [],
  };
}

describe('ARIA canonical RAG retrieval execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCapability.mockImplementation((courseKey) => availableCapability(courseKey));
  });

  it('U031 builds a SUCCESS plan only from the verified companion capability tuple', () => {
    const resolution = resolveAriaRetrievalPlan('eds-maths-premiere', 'CORRECTION');
    expect(resolution).toMatchObject({
      status: 'AVAILABLE',
      plan: {
        courseKey: 'eds-maths-premiere',
        pedagogicalMode: 'CORRECTION',
        collection: fixture.retrievalScope.evidence_subject.collection,
        corpusId: fixture.request.corpus_id,
        manifestSha256: MANIFEST_SHA,
        retrievalScopeSha256: fixture.retrievalScopeSha256,
      },
    });
    expect(mockCapability).toHaveBeenCalledWith('eds-maths-premiere', 'CORRECTION', 'TUTOR');
  });

  it('U034 ARIA-B-R036 preserves NOT_CONFIGURED and UNAVAILABLE as distinct plan states', () => {
    mockCapability.mockReturnValueOnce({ status: 'NOT_CONFIGURED', reasonCode: 'NO_CORPUS' });
    expect(resolveAriaRetrievalPlan('stmg-sgn-premiere')).toEqual({
      status: 'NOT_CONFIGURED', reasonCode: 'NO_CORPUS',
    });
    mockCapability.mockReturnValueOnce({ status: 'UNAVAILABLE', reasonCode: 'DIGEST_MISMATCH' });
    expect(resolveAriaRetrievalPlan('eds-nsi-premiere')).toEqual({
      status: 'UNAVAILABLE', reasonCode: 'DIGEST_MISMATCH',
    });
  });

  it('fails closed without a canonically resolved student RAG identity', async () => {
    const resolution = resolveAriaRetrievalPlan('eds-maths-premiere');
    if (resolution.status !== 'AVAILABLE') throw new Error('fixture plan unavailable');
    const plan = resolution.plan;
    const search = jest.fn();
    await expect(executeAriaRetrieval(plan, 'question', null, {
      ...executionDependencies,
      search,
    })).resolves.toMatchObject({
      status: 'RUNTIME_UNAVAILABLE',
      error: 'ACADEMIC_CONTEXT_UNREPRESENTABLE',
    });
    expect(search).not.toHaveBeenCalled();
  });

  it('builds the strict manifest-bound request and accepts only current-Turn immutable hits', async () => {
    const resolution = resolveAriaRetrievalPlan('eds-maths-premiere');
    if (resolution.status !== 'AVAILABLE') throw new Error('fixture plan unavailable');
    const plan = resolution.plan;
    const search = jest.fn<ReturnType<typeof searchAriaRagV2>, Parameters<typeof searchAriaRagV2>>(
      async () => validResponse(),
    );
    const result = await executeAriaRetrieval(plan, 'Dérivation et tangente', identity, {
      ...executionDependencies,
      search,
    });

    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.hits[0]).toMatchObject({
        resourceId: RESOURCE_ID,
        resourceVersionId: VERSION_ID,
        contentSha256: CONTENT_SHA,
        chunkId: 'chunk-1',
        manifestSha256: MANIFEST_SHA,
      });
    }
    expect(search).toHaveBeenCalledTimes(1);
    const call = search.mock.calls[0][0];
    expect(call.request).toMatchObject({
      manifest_sha256: MANIFEST_SHA,
      corpus_id: plan.corpusId,
      corpus_version_id: plan.corpusVersionId,
      curriculum_scope: fixture.request.curriculum_scope,
      student_profile: fixture.request.student_profile,
      need: { query: 'Dérivation et tangente' },
    });
    expect(call.identityToken.split('.')).toHaveLength(3);
  });

  it('U032 ARIA-B-R035 returns NO_RESULTS for an empty result set but preserves provider failure categories', async () => {
    const resolution = resolveAriaRetrievalPlan('eds-maths-premiere');
    if (resolution.status !== 'AVAILABLE') throw new Error('fixture plan unavailable');
    const plan = resolution.plan;
    await expect(executeAriaRetrieval(plan, 'question', identity, {
      ...executionDependencies,
      search: async () => ({ results: [], filters_applied: {}, warnings: [] }),
    })).resolves.toMatchObject({ status: 'NO_RESULTS' });

    await expect(executeAriaRetrieval(plan, 'question', identity, {
      ...executionDependencies,
      search: async () => { throw new AriaRagEngineClientError('TIMEOUT'); },
    })).resolves.toMatchObject({ status: 'RUNTIME_UNAVAILABLE', error: 'RAG_TIMEOUT' });
  });

  it('ARIA-B-R041 rejects a hit that is not an exact subset of this plan manifest', async () => {
    const resolution = resolveAriaRetrievalPlan('eds-maths-premiere');
    if (resolution.status !== 'AVAILABLE') throw new Error('fixture plan unavailable');
    const plan = resolution.plan;
    const response = validResponse();
    response.results[0].resource_version_id = '33333333-3333-4333-8333-333333333333';
    await expect(executeAriaRetrieval(plan, 'question', identity, {
      ...executionDependencies,
      search: async () => response,
    })).resolves.toMatchObject({
      status: 'RUNTIME_UNAVAILABLE', error: 'RAG_PROTOCOL_INVALID',
    });
  });
});
