const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
let evaluateWithFreshEvidence;
beforeAll(async () => {
  ({ evaluateWithFreshEvidence } = await import('../../scripts/github/review-gate/run.mjs'));
});

const clean = JSON.stringify({ review_complete: true, blocking_findings: [], warnings: [] });
function evidence() {
  return {
    pr: { number: 42, state: 'open', draft: false,
      base: { ref: 'main', sha: BASE }, head: { sha: HEAD }, mergeable: true },
    reviewedHeadSha: HEAD, reviewedBaseSha: BASE, currentHeadSha: HEAD, currentBaseSha: BASE,
    diffBaseSha: BASE, diffHeadSha: HEAD, requiredCheckTargetSha: HEAD,
    effectiveRules: [{ type: 'required_status_checks', parameters: { required_status_checks: [
      { context: 'CI Success', integration_id: 15368 },
    ] } }], rulesComplete: true,
    checkRuns: [{ id: 1, name: 'CI Success', app: { id: 15368 }, head_sha: HEAD,
      status: 'completed', conclusion: 'success', started_at: '2026-10-02T10:00:00Z',
      completed_at: '2026-10-02T10:01:00Z' }], checksComplete: true,
    statuses: [], statusesComplete: true, diffAvailable: true, diffComplete: true,
    files: [{ filename: 'app/page.tsx', status: 'modified', patch: '@@ -1 +1 @@\n-old\n+new',
      additions: 1, deletions: 1, changes: 2 }],
    reviews: [], reviewsComplete: true, threadsComplete: true,
    unresolvedReviewThreads: 0, applicableChangesRequested: 0,
  };
}

describe('fresh evidence surrounds semantic review', () => {
  test('success requires two complete collections and one final ref reread', async () => {
    const collect = jest.fn(async () => evidence());
    const runSemantic = jest.fn(async () => ({ correctness: clean, security: clean, runtime: clean }));
    const reread = jest.fn(async () => ({ stable: true, currentHeadSha: HEAD, currentBaseSha: BASE }));
    const verdict = await evaluateWithFreshEvidence({ collect, runSemantic, reread, qualifiedModel: true });
    expect(verdict.conclusion).toBe('success');
    expect(collect).toHaveBeenCalledTimes(2);
    expect(runSemantic).toHaveBeenCalledTimes(1);
    expect(reread).toHaveBeenCalledTimes(1);
  });

  test('a changed head during inference cannot succeed', async () => {
    const collect = jest.fn().mockResolvedValueOnce(evidence()).mockResolvedValueOnce({
      ...evidence(), pr: { ...evidence().pr, head: { sha: 'c'.repeat(40) } },
    });
    const verdict = await evaluateWithFreshEvidence({ collect,
      runSemantic: async () => ({ correctness: clean, security: clean, runtime: clean }),
      reread: async () => ({ stable: true, currentHeadSha: HEAD, currentBaseSha: BASE }),
      qualifiedModel: true });
    expect(verdict.conclusion).toBe('failure');
  });

  test('a final ref race refuses success even after all other gates passed', async () => {
    const verdict = await evaluateWithFreshEvidence({ collect: async () => evidence(),
      runSemantic: async () => ({ correctness: clean, security: clean, runtime: clean }),
      reread: async () => ({ stable: false, currentHeadSha: 'c'.repeat(40), currentBaseSha: BASE }),
      qualifiedModel: true });
    expect(verdict).toEqual(expect.objectContaining({ conclusion: 'failure', reason: 'STALE_HEAD' }));
  });

  test('reviewer timeout, unavailable model or API error fail closed', async () => {
    const base = { collect: async () => evidence(),
      reread: async () => ({ stable: true, currentHeadSha: HEAD, currentBaseSha: BASE }) };
    expect((await evaluateWithFreshEvidence({ ...base, qualifiedModel: false,
      runSemantic: async () => { throw new Error('must not run'); } })).conclusion)
      .toBe('action_required');
    expect((await evaluateWithFreshEvidence({ ...base, qualifiedModel: true,
      runSemantic: async () => { throw new Error('timeout'); } })).conclusion)
      .toBe('failure');
    const collect = jest.fn().mockResolvedValueOnce(evidence()).mockRejectedValueOnce(new Error('API'));
    expect((await evaluateWithFreshEvidence({ ...base, collect, qualifiedModel: true,
      runSemantic: async () => ({ correctness: clean, security: clean, runtime: clean }) })).conclusion)
      .toBe('failure');
  });
});
