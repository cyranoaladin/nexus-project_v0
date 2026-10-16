const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const REPO = 'cyranoaladin/nexus-project_v0';

let collectGateEvidence;
let rereadGateRefs;

beforeAll(async () => {
  ({ collectGateEvidence, rereadGateRefs } = await import('../../scripts/github/review-gate/collect.mjs'));
});

function fixture(overrides = {}) {
  const calls = [];
  const pr = { number: 42, state: 'open', draft: false, changed_files: 1,
    base: { ref: 'main', sha: BASE }, head: { sha: HEAD }, mergeable: true };
  const check = (name, appId, id) => ({ id, name, head_sha: HEAD, app: { id: appId },
    status: 'completed', conclusion: 'success', started_at: '2026-10-02T10:00:00Z',
    completed_at: '2026-10-02T10:01:00Z' });
  const values = {
    pr,
    rules: [{ type: 'required_status_checks', parameters: { required_status_checks: [
      { context: 'CI Success', integration_id: 15368 },
      { context: 'GitGuardian Security Checks', integration_id: 46505 },
    ] } }],
    files: [{ filename: 'app/page.tsx', status: 'modified', patch: '@@ -1 +1 @@\n-old\n+new',
      additions: 1, deletions: 1, changes: 2 }],
    checks: [check('CI Success', 15368, 1), check('GitGuardian Security Checks', 46505, 2)],
    statuses: [],
    reviews: [],
    threads: [{ isResolved: true }],
    ...overrides,
  };
  const readApi = jest.fn(async (path) => {
    calls.push(path);
    const page = Number(new URL(path, 'https://api.github.com').searchParams.get('page') ?? 1);
    if (path.startsWith(`/repos/${REPO}/pulls/42/files?`)) return page === 1 ? values.files : [];
    if (path === `/repos/${REPO}/pulls/42`) return values.pr;
    if (path.startsWith(`/repos/${REPO}/pulls/42/reviews?`)) return page === 1 ? values.reviews : [];
    if (path.startsWith(`/repos/${REPO}/rules/branches/main?`)) return page === 1 ? values.rules : [];
    if (path.startsWith(`/repos/${REPO}/commits/${HEAD}/check-runs?`)) return {
      total_count: values.checks.length, check_runs: page === 1 ? values.checks : [],
    };
    if (path.startsWith(`/repos/${REPO}/commits/${HEAD}/statuses?`)) return page === 1 ? values.statuses : [];
    throw new Error(`unexpected path ${path}`);
  });
  const readGraphql = jest.fn(async () => ({ data: { repository: { pullRequest: {
    reviewThreads: { nodes: values.threads, pageInfo: { hasNextPage: false, endCursor: null } },
  } } } }));
  return { readApi, readGraphql, calls, values };
}

describe('read-only GitHub gate evidence collector', () => {
  test('collects exact-head complete evidence without any write method', async () => {
    const api = fixture();
    const result = await collectGateEvidence({ repo: REPO, prNumber: 42, ...api });
    expect(result).toEqual(expect.objectContaining({
      reviewedHeadSha: HEAD, currentHeadSha: HEAD, reviewedBaseSha: BASE,
      currentBaseSha: BASE, rulesComplete: true, checksComplete: true,
      statusesComplete: true, diffAvailable: true, diffComplete: true,
      diffBaseSha: BASE, diffHeadSha: HEAD, requiredCheckTargetSha: HEAD,
      unresolvedReviewThreads: 0, applicableChangesRequested: 0,
    }));
    expect(result.files).toEqual(api.values.files);
    expect(result.prNumber).toBe(42);
    expect(Number.isFinite(Date.parse(result.evaluationStartedAt))).toBe(true);
    expect(result.cubic.realReview).toBe(false);
    expect(api.calls.every((path) => typeof path === 'string' && !path.includes('token'))).toBe(true);
  });

  test('re-read detects head or base race', async () => {
    const api = fixture();
    expect(await rereadGateRefs({ repo: REPO, prNumber: 42, readApi: api.readApi,
      expectedHeadSha: HEAD, expectedBaseSha: BASE })).toEqual({
      currentHeadSha: HEAD, currentBaseSha: BASE, stable: true,
    });
    api.values.pr = { ...api.values.pr, head: { sha: 'c'.repeat(40) } };
    expect((await rereadGateRefs({ repo: REPO, prNumber: 42, readApi: api.readApi,
      expectedHeadSha: HEAD, expectedBaseSha: BASE })).stable).toBe(false);
  });

  test('changed head during evidence collection fails closed', async () => {
    const api = fixture();
    const original = api.readApi;
    let reads = 0;
    api.readApi = async (path) => {
      if (path === `/repos/${REPO}/pulls/42` && ++reads === 2) {
        api.values.pr = { ...api.values.pr, head: { sha: 'c'.repeat(40) } };
      }
      return original(path);
    };
    await expect(collectGateEvidence({ repo: REPO, prNumber: 42, ...api }))
      .rejects.toThrow('PR_CHANGED_DURING_COLLECTION');
  });

  test('refuses missing patch even when GitHub reports file metadata', async () => {
    const api = fixture({ files: [{ filename: 'app/page.tsx', status: 'modified',
      additions: 1, deletions: 1, changes: 2 }] });
    await expect(collectGateEvidence({ repo: REPO, prNumber: 42, ...api }))
      .rejects.toThrow('DIFF_INCOMPLETE');
  });

  test('refuses changed file count mismatch and API cap', async () => {
    const api = fixture();
    api.values.pr.changed_files = 2;
    await expect(collectGateEvidence({ repo: REPO, prNumber: 42, ...api }))
      .rejects.toThrow('DIFF_INCOMPLETE');
    api.values.pr.changed_files = 3001;
    await expect(collectGateEvidence({ repo: REPO, prNumber: 42, ...api }))
      .rejects.toThrow('DIFF_TOO_LARGE');
  });

  test('refuses missing or malformed rules and check runs', async () => {
    const api = fixture({ rules: [] });
    await expect(collectGateEvidence({ repo: REPO, prNumber: 42, ...api }))
      .rejects.toThrow('RULESET_INCOMPLETE');
    api.values.rules = fixture().values.rules;
    api.values.checks = [{ id: 1 }];
    await expect(collectGateEvidence({ repo: REPO, prNumber: 42, ...api }))
      .rejects.toThrow('CHECK_RUNS_INVALID');
  });

  test('fails closed on API uncertainty', async () => {
    const api = fixture();
    api.readGraphql.mockRejectedValueOnce(new Error('rate limited'));
    await expect(collectGateEvidence({ repo: REPO, prNumber: 42, ...api }))
      .rejects.toThrow('GITHUB_EVIDENCE_UNAVAILABLE');
  });

  test('reads unresolved threads and latest applicable CHANGES_REQUESTED', async () => {
    const api = fixture({
      threads: [{ isResolved: false }, { isResolved: true }],
      reviews: [
        { id: 1, user: { login: 'reviewer' }, state: 'APPROVED', commit_id: HEAD },
        { id: 2, user: { login: 'reviewer' }, state: 'CHANGES_REQUESTED', commit_id: HEAD },
      ],
    });
    const result = await collectGateEvidence({ repo: REPO, prNumber: 42, ...api });
    expect(result.unresolvedReviewThreads).toBe(1);
    expect(result.applicableChangesRequested).toBe(1);
    expect(result.reviewsComplete).toBe(true);
  });

  test('paginates PR files, rules, reviews and check-runs without ignoring later pages', async () => {
    const api = fixture();
    const checks = api.values.checks;
    const original = api.readApi;
    api.values.pr.changed_files = 101;
    api.values.files = Array.from({ length: 101 }, (_, index) => ({
      filename: `app/file-${index}.tsx`, status: 'modified', patch: '@@ -1 +1 @@\n-a\n+b',
      additions: 1, deletions: 1, changes: 2,
    }));
    api.values.checks = Array.from({ length: 101 }, (_, index) => ({
      ...checks[0], id: index + 1, name: index === 100 ? checks[1].name : `test-${index}`,
      app: { id: index === 100 ? 46505 : 15368 },
    }));
    api.readApi = async (path) => {
      const url = new URL(path, 'https://api.github.com');
      const page = Number(url.searchParams.get('page') ?? 1);
      if (path.startsWith(`/repos/${REPO}/pulls/42/files?`)) {
        return api.values.files.slice((page - 1) * 100, page * 100);
      }
      if (path.startsWith(`/repos/${REPO}/commits/${HEAD}/check-runs?`)) {
        return { total_count: api.values.checks.length,
          check_runs: api.values.checks.slice((page - 1) * 100, page * 100) };
      }
      return original(path);
    };
    const result = await collectGateEvidence({ repo: REPO, prNumber: 42, ...api });
    expect(result.files).toHaveLength(101);
    expect(result.checkRuns).toHaveLength(101);
  });

  test('GraphQL partial errors or incomplete review-thread cursor fail closed', async () => {
    const api = fixture();
    api.readGraphql.mockResolvedValueOnce({ errors: [{ message: 'partial' }],
      data: { repository: { pullRequest: { reviewThreads: {
        nodes: [], pageInfo: { hasNextPage: false, endCursor: null },
      } } } } });
    await expect(collectGateEvidence({ repo: REPO, prNumber: 42, ...api }))
      .rejects.toThrow('REVIEW_THREADS_INCOMPLETE');
    api.readGraphql.mockResolvedValueOnce({ data: { repository: { pullRequest: {
      reviewThreads: { nodes: [], pageInfo: { hasNextPage: true, endCursor: null } },
    } } } });
    await expect(collectGateEvidence({ repo: REPO, prNumber: 42, ...api }))
      .rejects.toThrow('REVIEW_THREADS_INCOMPLETE');
  });

  test('Cubic neutral and no-review success are not real reviews', async () => {
    for (const conclusion of ['neutral', 'success']) {
      const api = fixture({ checks: [
        ...fixture().values.checks,
        { id: 3, name: 'Cubic', head_sha: HEAD, app: { id: 1082092 },
          status: 'completed', conclusion,
          output: { summary: conclusion === 'neutral' ? 'Monthly quota exhausted' : 'AI review not needed for merge commit' },
          started_at: '2026-10-02T10:00:00Z', completed_at: '2026-10-02T10:01:00Z' },
      ] });
      expect((await collectGateEvidence({ repo: REPO, prNumber: 42, ...api })).cubic.realReview).toBe(false);
    }
  });
});
