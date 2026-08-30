jest.mock('@/lib/aria/rag', () => ({
  executeAriaRetrieval: jest.fn(),
  resolveAriaRetrievalPlan: jest.fn(),
}));

jest.mock('@/lib/aria/infrastructure/rag/disposable-academic-identity', () => ({
  resolveDisposableAriaRagIdentity: jest.fn(),
}));

jest.mock('@/lib/aria/gateway', () => ({
  streamChatCompletion: jest.fn(),
}));

import {
  executeCanonicalRetrieval,
  streamCanonicalAriaModel,
} from '@/lib/aria/application/conversation/execute';
import { executeAriaRetrieval, resolveAriaRetrievalPlan } from '@/lib/aria/rag';
import { resolveDisposableAriaRagIdentity } from '@/lib/aria/infrastructure/rag/disposable-academic-identity';
import { streamChatCompletion } from '@/lib/aria/gateway';

describe('canonical retrieval academic identity boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes only the guarded disposable identity adapter result to retrieval execution', async () => {
    const plan = {
      courseKey: 'eds-nsi-premiere',
      manifestSha256: 'a'.repeat(64),
      corpusId: 'aria-nsi-premiere',
      corpusVersionId: 'fixture-v1',
      retrievalScope: {},
    };
    const context = {
      courseKey: 'eds-nsi-premiere',
      subject: { studentId: 'student-1' },
    };
    const identity = { pseudonymousSubject: 'psn_fixture' };
    (resolveAriaRetrievalPlan as jest.Mock).mockReturnValueOnce({ status: 'AVAILABLE', plan });
    (resolveDisposableAriaRagIdentity as jest.Mock).mockReturnValueOnce(identity);
    (executeAriaRetrieval as jest.Mock).mockResolvedValueOnce({ status: 'NO_RESULTS', plan });

    await expect(executeCanonicalRetrieval({
      context,
      policy: { kind: 'GROUNDED_REQUIRED', task: 'DISCOVERY' },
      query: 'Explique les piles.',
      signal: new AbortController().signal,
    } as never)).resolves.toMatchObject({
      status: 'NO_RESULTS',
      attempted: {
        manifestSha256: 'a'.repeat(64),
        corpusId: 'aria-nsi-premiere',
        corpusVersionId: 'fixture-v1',
      },
    });
    expect(resolveDisposableAriaRagIdentity).toHaveBeenCalledWith({ context, plan });
    expect(executeAriaRetrieval).toHaveBeenCalledWith(
      plan,
      'Explique les piles.',
      identity,
      { signal: expect.any(AbortSignal) },
    );
  });

  it('keeps manifest runtime UNAVAILABLE distinct from an absent corpus without model downgrade', async () => {
    const context = {
      courseKey: 'eds-nsi-premiere',
      subject: { studentId: 'student-1' },
    };
    (resolveAriaRetrievalPlan as jest.Mock).mockReturnValueOnce({
      status: 'UNAVAILABLE',
      reasonCode: 'SERVABLE_MANIFEST_DIGEST_MISMATCH',
    });

    await expect(executeCanonicalRetrieval({
      context,
      policy: { kind: 'GROUNDED_REQUIRED', task: 'DISCOVERY' },
      query: 'Explique les piles.',
      signal: new AbortController().signal,
    } as never)).resolves.toEqual({
      status: 'RUNTIME_UNAVAILABLE',
      hits: [],
      failureReason: 'SERVABLE_MANIFEST_DIGEST_MISMATCH',
    });
    expect(resolveDisposableAriaRagIdentity).not.toHaveBeenCalled();
    expect(executeAriaRetrieval).not.toHaveBeenCalled();
  });

  it('keeps an undeclared corpus explicitly NOT_CONFIGURED', async () => {
    (resolveAriaRetrievalPlan as jest.Mock).mockReturnValueOnce({
      status: 'NOT_CONFIGURED',
      reasonCode: 'COURSE_HAS_NO_DECLARED_CORPUS',
    });
    await expect(executeCanonicalRetrieval({
      context: { courseKey: 'stmg-sgn-premiere' },
      policy: { kind: 'GROUNDED_REQUIRED', task: 'DISCOVERY' },
      query: 'Question',
      signal: new AbortController().signal,
    } as never)).resolves.toEqual({
      status: 'NOT_CONFIGURED',
      hits: [],
      failureReason: 'COURSE_HAS_NO_DECLARED_CORPUS',
    });
  });

  it('preserves immutable hit identity for the application exact-resource gate', async () => {
    const plan = {
      courseKey: 'eds-nsi-premiere',
      manifestSha256: 'a'.repeat(64),
      corpusId: 'aria-nsi-premiere',
      corpusVersionId: 'fixture-v1',
      retrievalScope: {},
    };
    const context = {
      courseKey: 'eds-nsi-premiere',
      subject: { studentId: 'student-1' },
    };
    const identity = { pseudonymousSubject: 'psn_fixture' };
    const otherResourceHit = {
      id: 'chunk-other',
      resourceId: 'resource-other',
      resourceVersionId: 'version-other',
      contentSha256: 'c'.repeat(64),
      chunkId: 'chunk-other',
      locator: { page: 4 },
      corpusId: plan.corpusId,
      corpusVersionId: plan.corpusVersionId,
      manifestSha256: plan.manifestSha256,
      sourceTitle: 'Autre ressource',
      sourceDocument: 'other.pdf',
      courseKey: plan.courseKey,
      provenance: 'OFFICIEL_MEN',
      snippet: 'Extrait',
      score: 0.8,
    };
    (resolveAriaRetrievalPlan as jest.Mock).mockReturnValueOnce({ status: 'AVAILABLE', plan });
    (resolveDisposableAriaRagIdentity as jest.Mock).mockReturnValueOnce(identity);
    (executeAriaRetrieval as jest.Mock).mockResolvedValueOnce({
      status: 'SUCCESS', hits: [otherResourceHit], plan,
    });

    await expect(executeCanonicalRetrieval({
      context,
      policy: {
        kind: 'RESOURCE_GROUNDED_REQUIRED',
        task: 'DISCOVERY',
        requestedResource: { resourceId: 'resource-1', resourceVersionId: 'version-1' },
      },
      query: 'Explique la ressource demandée.',
      signal: new AbortController().signal,
    } as never)).resolves.toMatchObject({
      status: 'SUCCESS',
      hits: [{
        resourceId: 'resource-other',
        resourceVersionId: 'version-other',
        contentSha256: 'c'.repeat(64),
        chunkId: 'chunk-other',
      }],
    });
  });
});

describe('canonical model gateway boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('forwards an authorized fallback as bounded application metadata', async () => {
    async function* chunks() {
      yield 'Réponse de secours';
    }
    (streamChatCompletion as jest.Mock).mockImplementationOnce((_messages, options) => {
      options.onFallback({
        fromProvider: 'OPENAI_HOSTED',
        toProvider: 'OPENAI_COMPATIBLE_LOCAL',
        reasonCode: 'PRIMARY_PROVIDER_UNAVAILABLE',
      });
      return chunks();
    });
    const onFallback = jest.fn();

    const received: string[] = [];
    for await (const token of streamCanonicalAriaModel(
      [{ role: 'user', content: 'Question' }],
      { signal: new AbortController().signal, onFallback },
    )) {
      received.push(token);
    }

    expect(received).toEqual(['Réponse de secours']);
    expect(onFallback).toHaveBeenCalledWith({
      reasonCode: 'PRIMARY_PROVIDER_UNAVAILABLE',
    });
    expect(JSON.stringify(onFallback.mock.calls)).not.toContain('OPENAI_HOSTED');
    expect(JSON.stringify(onFallback.mock.calls)).not.toContain('OPENAI_COMPATIBLE_LOCAL');
    expect(JSON.stringify(onFallback.mock.calls)).not.toContain('fromProvider');
    expect(JSON.stringify(onFallback.mock.calls)).not.toContain('toProvider');
  });
});
