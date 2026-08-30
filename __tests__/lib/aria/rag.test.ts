jest.mock('@/lib/rag-client', () => ({ ragSearch: jest.fn() }));
jest.mock('@/lib/aria/infrastructure/rag/manifest', () => ({
  getAriaRagCorpusCapability: jest.fn(),
}));

import { buildAriaRetrievalPlan, executeAriaRetrieval } from '@/lib/aria/rag';
import { ragSearch, type RAGSearchHit } from '@/lib/rag-client';
import { getAriaRagCorpusCapability } from '@/lib/aria/infrastructure/rag/manifest';

const mockRagSearch = ragSearch as jest.MockedFunction<typeof ragSearch>;
const mockCapability = getAriaRagCorpusCapability as jest.MockedFunction<typeof getAriaRagCorpusCapability>;
const RESOURCE_ID = '11111111-1111-4111-8111-111111111111';
const VERSION_ID = '22222222-2222-4222-8222-222222222222';
const CONTENT_SHA = 'd'.repeat(64);
const MANIFEST_SHA = 'e'.repeat(64);
const LOCATOR = { page: 2 };

function availableCapability(courseKey: string) {
  return {
    status: 'AVAILABLE' as const,
    corpus: {
      corpusId: `aria-${courseKey}`,
      corpusVersionId: '2026.08.30.1',
      physicalCollection: 'verified_collection',
      manifestSha256: MANIFEST_SHA,
      resourceRegistrySha256: 'a'.repeat(64),
      academicYear: '2026-2027',
      curriculumVersion: 'fr-lycee-2026',
      resourceBindings: [{
        resourceId: RESOURCE_ID,
        resourceVersionId: VERSION_ID,
        contentSha256: CONTENT_SHA,
        chunks: [{ chunkId: 'chunk-1', locator: LOCATOR }],
      }],
    },
  };
}

describe('ARIA RAG Retrieval Contract & Execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCapability.mockImplementation((courseKey) => availableCapability(courseKey));
  });

  it('builds a plan only from the verified companion capability', () => {
    const plan = buildAriaRetrievalPlan('eds-maths-premiere');
    expect(plan).toMatchObject({
      courseKey: 'eds-maths-premiere',
      collection: 'verified_collection',
      corpusId: 'aria-eds-maths-premiere',
      manifestSha256: MANIFEST_SHA,
    });
    expect(mockCapability).toHaveBeenCalledWith('eds-maths-premiere', 'DISCOVERY', 'TUTOR');
  });

  it('returns no plan when the companion corpus is not configured or unavailable', () => {
    mockCapability.mockReturnValueOnce({ status: 'NOT_CONFIGURED', reasonCode: 'NO_CORPUS' });
    expect(buildAriaRetrievalPlan('stmg-sgn-premiere')).toBeNull();
    mockCapability.mockReturnValueOnce({ status: 'UNAVAILABLE', reasonCode: 'DIGEST_MISMATCH' });
    expect(buildAriaRetrievalPlan('eds-nsi-premiere')).toBeNull();
  });

  it('returns NOT_CONFIGURED for a null plan and NO_RESULTS for a blank query', async () => {
    await expect(executeAriaRetrieval(null, 'question')).resolves.toMatchObject({ status: 'NOT_CONFIGURED' });
    const plan = buildAriaRetrievalPlan('eds-maths-premiere')!;
    await expect(executeAriaRetrieval(plan, '   ')).resolves.toMatchObject({ status: 'NO_RESULTS' });
    expect(mockRagSearch).not.toHaveBeenCalled();
  });

  it('accepts only a hit whose immutable identity is bound to the current manifest', async () => {
    const plan = buildAriaRetrievalPlan('eds-maths-premiere')!;
    mockRagSearch.mockResolvedValueOnce([{
      id: 'hit-1',
      document: 'Théorème de dérivation des fonctions composées.',
      metadata: {
        resource_id: RESOURCE_ID,
        resource_version_id: VERSION_ID,
        content_sha256: CONTENT_SHA,
        chunk_id: 'chunk-1',
        locator: LOCATOR,
        corpus_id: plan.corpusId,
        corpus_version_id: plan.corpusVersionId,
        manifest_sha256: MANIFEST_SHA,
        title: 'Chapitre 3 : Dérivation',
        source_uri: 'https://education.gouv.fr/programme.pdf',
        source_label: 'Ministère de l’Éducation nationale',
        rights: 'officiel_public',
      },
      distance: 0.15,
    } as RAGSearchHit]);

    const result = await executeAriaRetrieval(plan, 'formule dérivée composée');
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
    expect(mockRagSearch).toHaveBeenCalledWith(expect.objectContaining({
      failureMode: 'throw',
      k: 8,
    }));
  });

  it('reports malformed or out-of-manifest identities as runtime unavailable', async () => {
    const plan = buildAriaRetrievalPlan('eds-maths-premiere')!;
    mockRagSearch.mockResolvedValueOnce([{
      id: 'hit-unbound', document: 'unbound', distance: 0,
      metadata: { resource_id: RESOURCE_ID },
    } as RAGSearchHit]);
    await expect(executeAriaRetrieval(plan, 'question')).resolves.toMatchObject({
      status: 'RUNTIME_UNAVAILABLE', error: 'RAG_RUNTIME_UNAVAILABLE',
    });
  });

  it('keeps provider failure observable instead of returning NO_RESULTS', async () => {
    const plan = buildAriaRetrievalPlan('eds-maths-terminale')!;
    mockRagSearch.mockRejectedValueOnce(new Error('private provider detail'));
    await expect(executeAriaRetrieval(plan, 'continuité et limites')).resolves.toMatchObject({
      status: 'RUNTIME_UNAVAILABLE', error: 'RAG_RUNTIME_UNAVAILABLE',
    });
  });
});
