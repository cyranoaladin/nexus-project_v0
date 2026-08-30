jest.mock('@/lib/aria/rag', () => ({
  executeAriaRetrieval: jest.fn(),
  resolveAriaRetrievalPlan: jest.fn(),
}));

jest.mock('@/lib/aria/infrastructure/rag/disposable-academic-identity', () => ({
  resolveDisposableAriaRagIdentity: jest.fn(),
}));

import { executeCanonicalRetrieval } from '@/lib/aria/application/conversation/execute';
import { executeAriaRetrieval, resolveAriaRetrievalPlan } from '@/lib/aria/rag';
import { resolveDisposableAriaRagIdentity } from '@/lib/aria/infrastructure/rag/disposable-academic-identity';

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
});
