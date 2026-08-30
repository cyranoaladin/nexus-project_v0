jest.mock('@/lib/aria/rag', () => ({
  buildAriaRetrievalPlan: jest.fn(),
  executeAriaRetrieval: jest.fn(),
}));

jest.mock('@/lib/aria/infrastructure/rag/disposable-academic-identity', () => ({
  resolveDisposableAriaRagIdentity: jest.fn(),
}));

import { executeCanonicalRetrieval } from '@/lib/aria/application/conversation/execute';
import { buildAriaRetrievalPlan, executeAriaRetrieval } from '@/lib/aria/rag';
import { resolveDisposableAriaRagIdentity } from '@/lib/aria/infrastructure/rag/disposable-academic-identity';

describe('canonical retrieval academic identity boundary', () => {
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
    (buildAriaRetrievalPlan as jest.Mock).mockReturnValueOnce(plan);
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
});
