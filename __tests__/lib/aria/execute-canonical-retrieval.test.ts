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
import { toAriaJsonResponse } from '@/lib/aria/transport/json';
import { formatAriaSSEEvent } from '@/lib/aria/transport/sse-parser';

describe('canonical retrieval academic identity boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps explicit general chat outside retrieval without resolving a corpus', async () => {
    await expect(executeCanonicalRetrieval({
      context: { courseKey: 'eds-maths-terminale' },
      policy: { kind: 'GENERAL_CHAT', task: 'DISCOVERY' },
      query: 'Bonjour',
      signal: new AbortController().signal,
    } as never)).resolves.toEqual({ status: 'NOT_CONFIGURED', hits: [] });
    expect(resolveAriaRetrievalPlan).not.toHaveBeenCalled();
    expect(executeAriaRetrieval).not.toHaveBeenCalled();
  });

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

  it('preserves an attempted corpus and failure reason when the retrieval runtime fails', async () => {
    const plan = {
      courseKey: 'eds-nsi-premiere',
      manifestSha256: 'a'.repeat(64),
      corpusId: 'aria-nsi-premiere',
      corpusVersionId: 'fixture-v1',
      retrievalScope: {},
    };
    (resolveAriaRetrievalPlan as jest.Mock).mockReturnValueOnce({ status: 'AVAILABLE', plan });
    (resolveDisposableAriaRagIdentity as jest.Mock).mockReturnValueOnce({
      pseudonymousSubject: 'psn_fixture',
    });
    (executeAriaRetrieval as jest.Mock).mockResolvedValueOnce({
      status: 'RUNTIME_UNAVAILABLE',
      error: 'RAG_ENGINE_TIMEOUT',
      plan,
    });

    await expect(executeCanonicalRetrieval({
      context: { courseKey: 'eds-nsi-premiere', subject: { studentId: 'student-1' } },
      policy: { kind: 'GROUNDED_REQUIRED', task: 'DISCOVERY' },
      query: 'Question',
      signal: new AbortController().signal,
    } as never)).resolves.toEqual({
      status: 'RUNTIME_UNAVAILABLE',
      hits: [],
      attempted: {
        manifestSha256: plan.manifestSha256,
        corpusId: plan.corpusId,
        corpusVersionId: plan.corpusVersionId,
      },
      failureReason: 'RAG_ENGINE_TIMEOUT',
    });
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
      resourceId: '0af21d67-1c3b-5a8a-8eed-38d23ecb1600',
      resourceVersionId: '73f3c1b9-a95f-586f-bfb6-00f2ecf68e82',
      contentSha256: '7ca9a32e1823be6c1120cb0417324c3cb01688d1d194c7614a88ea851ccc60b0',
      chunkId: 'chunk-other',
      locator: { page: 4 },
      corpusId: plan.corpusId,
      corpusVersionId: plan.corpusVersionId,
      manifestSha256: plan.manifestSha256,
      sourceTitle: 'Programme officiel — Spécialité NSI Première',
      sourceDocument: 'BO spécial n° 1 du 22 janvier 2019 — NOR MENE1901633A',
      sourceLocation: 'Page 4',
      courseKey: plan.courseKey,
      provenance: 'OFFICIEL_MEN',
      url: 'https://www.education.gouv.fr/bo/19/Special1/MENE1901633A.htm',
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
        resourceId: otherResourceHit.resourceId,
        resourceVersionId: otherResourceHit.resourceVersionId,
        contentSha256: otherResourceHit.contentSha256,
        chunkId: 'chunk-other',
      }],
    });
  });

  it('derives live citation display metadata before either JSON or SSE can serialize it', async () => {
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
    const forgedHit = {
      id: 'chunk-forged',
      resourceId: '0af21d67-1c3b-5a8a-8eed-38d23ecb1600',
      resourceVersionId: '73f3c1b9-a95f-586f-bfb6-00f2ecf68e82',
      contentSha256: '7ca9a32e1823be6c1120cb0417324c3cb01688d1d194c7614a88ea851ccc60b0',
      chunkId: 'chunk-forged',
      locator: { section: 'Programme officiel' },
      citationPage: 4,
      corpusId: plan.corpusId,
      corpusVersionId: plan.corpusVersionId,
      manifestSha256: plan.manifestSha256,
      sourceTitle: 'Faux ministère',
      sourceDocument: '/srv/private/student@example.test.pdf',
      sourceLocation: '/home/private/programme.pdf',
      courseKey: plan.courseKey,
      provenance: 'FORGED_OFFICIAL',
      url: 'https://attacker.example.test/programme.pdf',
      snippet: 'Extrait',
      score: 0.8,
    };
    (resolveAriaRetrievalPlan as jest.Mock).mockReturnValueOnce({ status: 'AVAILABLE', plan });
    (resolveDisposableAriaRagIdentity as jest.Mock).mockReturnValueOnce(identity);
    (executeAriaRetrieval as jest.Mock).mockResolvedValueOnce({
      status: 'SUCCESS', hits: [forgedHit], plan,
    });

    const retrieval = await executeCanonicalRetrieval({
      context,
      policy: { kind: 'GROUNDED_REQUIRED', task: 'DISCOVERY' },
      query: 'Explique les piles.',
      signal: new AbortController().signal,
    } as never);
    const canonicalCitation = retrieval.hits[0]!;
    expect(canonicalCitation).toMatchObject({
      sourceTitle: 'Programme officiel — Spécialité NSI Première',
      sourceDocument: 'BO spécial n° 1 du 22 janvier 2019 — NOR MENE1901633A',
      sourceLocation: 'Page 4',
      provenance: 'OFFICIEL_MEN',
      url: 'https://www.education.gouv.fr/bo/19/Special1/MENE1901633A.htm',
    });
    const executionResult = {
      turnId: 'turn-1', conversationId: 'conversation-1', messageId: 'message-1',
      status: 'COMPLETED' as const, disposition: 'EXECUTED' as const,
      fullText: 'Réponse', ragStatus: 'SUCCESS' as const, citations: [canonicalCitation],
    };
    const json = JSON.stringify(toAriaJsonResponse(executionResult, plan.courseKey));
    const sse = formatAriaSSEEvent({ event: 'citation', data: { citation: canonicalCitation } });
    expect(`${json}\n${sse}`).not.toMatch(
      /\/srv|\/home|student@example\.test|attacker\.example\.test|FORGED_OFFICIAL|Faux ministère/,
    );
  });

  it('rejects a valid Registry resource from a course other than the authorized context', async () => {
    const plan = {
      courseKey: 'eds-maths-terminale',
      manifestSha256: 'a'.repeat(64),
      corpusId: 'aria-maths-terminale',
      corpusVersionId: 'fixture-v1',
      retrievalScope: {},
    };
    const wrongCourseHit = {
      id: 'chunk-cross-course',
      resourceId: '0af21d67-1c3b-5a8a-8eed-38d23ecb1600',
      resourceVersionId: '73f3c1b9-a95f-586f-bfb6-00f2ecf68e82',
      contentSha256: '7ca9a32e1823be6c1120cb0417324c3cb01688d1d194c7614a88ea851ccc60b0',
      chunkId: 'chunk-cross-course',
      locator: { page: 2 },
      corpusId: plan.corpusId,
      corpusVersionId: plan.corpusVersionId,
      manifestSha256: plan.manifestSha256,
      sourceTitle: 'Programme NSI', sourceDocument: 'nsi.pdf',
      courseKey: 'eds-nsi-premiere', provenance: 'OFFICIEL_MEN', snippet: 'Extrait', score: 0.8,
    };
    (resolveAriaRetrievalPlan as jest.Mock).mockReturnValueOnce({ status: 'AVAILABLE', plan });
    (resolveDisposableAriaRagIdentity as jest.Mock).mockReturnValueOnce({
      pseudonymousSubject: 'psn_fixture',
    });
    (executeAriaRetrieval as jest.Mock).mockResolvedValueOnce({
      status: 'SUCCESS', hits: [wrongCourseHit], plan,
    });

    await expect(executeCanonicalRetrieval({
      context: { courseKey: 'eds-maths-terminale', subject: { studentId: 'student-1' } },
      policy: { kind: 'GROUNDED_REQUIRED', task: 'DISCOVERY' },
      query: 'Question de maths',
      signal: new AbortController().signal,
    } as never)).rejects.toMatchObject({
      code: 'RAG_UNAVAILABLE',
      internalDetails: { reasonCode: 'CITATION_COURSE_CONTEXT_MISMATCH' },
    });
  });

  it.each([
    'resourceId',
    'resourceVersionId',
    'contentSha256',
    'chunkId',
    'locator',
    'corpusId',
    'corpusVersionId',
    'manifestSha256',
  ] as const)('rejects a successful hit missing immutable identity field %s', async (field) => {
    const plan = {
      courseKey: 'eds-nsi-premiere',
      manifestSha256: 'a'.repeat(64),
      corpusId: 'aria-nsi-premiere',
      corpusVersionId: 'fixture-v1',
      retrievalScope: {},
    };
    const hit: Record<string, unknown> = {
      id: 'chunk-1',
      resourceId: '0af21d67-1c3b-5a8a-8eed-38d23ecb1600',
      resourceVersionId: '73f3c1b9-a95f-586f-bfb6-00f2ecf68e82',
      contentSha256: '7ca9a32e1823be6c1120cb0417324c3cb01688d1d194c7614a88ea851ccc60b0',
      chunkId: 'chunk-1',
      locator: { page: 1 },
      corpusId: plan.corpusId,
      corpusVersionId: plan.corpusVersionId,
      manifestSha256: plan.manifestSha256,
      sourceTitle: 'Programme NSI',
      sourceDocument: 'programme.pdf',
      courseKey: plan.courseKey,
      provenance: 'OFFICIEL_MEN',
      snippet: 'Extrait',
      score: 0.8,
    };
    hit[field] = undefined;
    (resolveAriaRetrievalPlan as jest.Mock).mockReturnValueOnce({ status: 'AVAILABLE', plan });
    (resolveDisposableAriaRagIdentity as jest.Mock).mockReturnValueOnce({
      pseudonymousSubject: 'psn_fixture',
    });
    (executeAriaRetrieval as jest.Mock).mockResolvedValueOnce({ status: 'SUCCESS', hits: [hit], plan });

    await expect(executeCanonicalRetrieval({
      context: { courseKey: plan.courseKey, subject: { studentId: 'student-1' } },
      policy: { kind: 'GROUNDED_REQUIRED', task: 'DISCOVERY' },
      query: 'Question',
      signal: new AbortController().signal,
    } as never)).rejects.toThrow('Canonical RAG hit is missing immutable identity');
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
